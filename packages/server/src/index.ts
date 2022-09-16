/// <reference lib="webworker" />

import type { RequestListener, ServerResponse } from 'node:http';
import { isReadable, isServerResponse, NodeRequest, normalizeNodeRequest, sendNodeResponse } from './utils';
import { Request as PonyfillRequestCtor } from '@whatwg-node/fetch';

export interface ServerAdapterOptions<TServerContext> {
  /**
   * An async function that takes `Request` and the server context and returns a `Response`.
   * If you use `requestListener`, the server context is `{ req: IncomingMessage, res: ServerResponse }`.
   */
  handle: (request: Request, serverContext: TServerContext) => Promise<Response>;
}

export interface ServerAdapterObject<TServerContext> extends EventListenerObject {
  /**
   * A basic request listener that takes a `Request` with the server context and returns a `Response`.
   */
  handleRequest: (request: Request, serverContext: TServerContext) => Promise<Response>;
  /**
   * WHATWG Fetch spec compliant `fetch` function that can be used for testing purposes.
   */
  fetch(request: Request, ...ctx: any[]): Promise<Response>;
  fetch(urlStr: string, ...ctx: any[]): Promise<Response>;
  fetch(urlStr: string, init: RequestInit, ...ctx: any[]): Promise<Response>;
  fetch(url: URL, ...ctx: any[]): Promise<Response>;
  fetch(url: URL, init: RequestInit, ...ctx: any[]): Promise<Response>;

  /**
   * This function takes Node's request object and returns a WHATWG Fetch spec compliant `Response` object.
   **/
  handleNodeRequest(nodeRequest: NodeRequest, serverContext: TServerContext): Promise<Response>;
  /**
   * A request listener function that can be used with any Node server variation.
   */
  requestListener: RequestListener;
  /**
   * Proxy to requestListener to mimic Node middlewares
   */
  handle: RequestListener & ServerAdapterObject<TServerContext>['fetch'];
}

export type ServerAdapter<TServerContext, TBaseObject> = TBaseObject &
  RequestListener &
  ServerAdapterObject<TServerContext>['fetch'] &
  ServerAdapterObject<TServerContext>;

async function handleWaitUntils(waitUntilPromises: Promise<unknown>[]) {
  const waitUntils = await Promise.allSettled(waitUntilPromises);
  waitUntils.forEach(waitUntil => {
    if (waitUntil.status === 'rejected') {
      console.error(waitUntil.reason);
    }
  });
}

export function createServerAdapter<
  TServerContext = {
    req: NodeRequest;
    res: ServerResponse;
    waitUntil(promise: Promise<unknown>): void;
  },
  TBaseObject extends ServerAdapterOptions<TServerContext> = ServerAdapterOptions<TServerContext>
>(
  serverAdapterBaseObject: TBaseObject, 
  /**
   * WHATWG Fetch spec compliant `Request` constructor.
   */
  RequestCtor = PonyfillRequestCtor,
): ServerAdapter<TServerContext, TBaseObject> {
  const handleRequest = serverAdapterBaseObject.handle;
  function fetchFn(input: RequestInfo | URL, init?: RequestInit, ...ctx: any[]): Promise<Response> {
    if (typeof input === 'string' || input instanceof URL) {
      return handleRequest(new RequestCtor(input, init), Object.assign({}, ...ctx));
    }
    return handleRequest(input, Object.assign({}, init, ...ctx));
  }

  function handleNodeRequest(nodeRequest: NodeRequest, serverContext: TServerContext): Promise<Response> {
    const request = normalizeNodeRequest(nodeRequest, RequestCtor);
    return handleRequest(request, serverContext);
  }

  async function requestListener(nodeRequest: NodeRequest, serverResponse: ServerResponse) {
    const waitUntilPromises: Promise<unknown>[] = [];
    const response = await handleNodeRequest(nodeRequest, {
      req: nodeRequest,
      res: serverResponse,
      waitUntil(p: Promise<unknown>) {
        waitUntilPromises.push(p);
      },
    } as any);
    if (response) {
      await sendNodeResponse(response, serverResponse);
    } else {
      await new Promise(resolve => {
        serverResponse.statusCode = 404;
        serverResponse.end(resolve);
      });
    }
    if (waitUntilPromises.length > 0) {
      await handleWaitUntils(waitUntilPromises);
    }
  }

  function handleEvent(event: FetchEvent) {
    if (!event.respondWith || !event.request) {
      throw new TypeError(`Expected FetchEvent, got ${event}`);
    }
    const response$ = handleRequest(event.request, event as any);
    event.respondWith(response$);
  }

  function genericRequestHandler(input: any, ctx: any, ...rest: any[]) {
    if ('process' in globalThis && process.versions?.['bun'] != null) {
      // This is required for bun
      input.text();
    }
    // If it is a Node request
    if (isReadable(input) && ctx != null && isServerResponse(ctx)) {
      return requestListener(input as unknown as NodeRequest, ctx);
    }
    // Is input a container object over Request?
    if (input.request) {
      // Is it FetchEvent?
      if (input.respondWith) {
        return handleEvent(input);
      }
      // In this input is also the context
      return handleRequest(input.request, input);
    }
    // Or is it Request itself?
    // Then ctx is present and it is the context
    if (rest?.length > 0) {
      ctx = Object.assign({}, ctx, ...rest);
    }
    if (!ctx.waitUntil) {
      const waitUntilPromises: Promise<unknown>[] = [];
      ctx.waitUntil = (p: Promise<unknown>) => {
        waitUntilPromises.push(p);
      };
      const response$ = handleRequest(input, {
        ...ctx,
        waitUntil(p: Promise<unknown>) {
          waitUntilPromises.push(p);
        },
      });
      if (waitUntilPromises.length > 0) {
        return handleWaitUntils(waitUntilPromises).then(() => response$);
      }
    }
    return handleRequest(input, ctx);
  }

  const adapterObj: ServerAdapterObject<TServerContext> = {
    handleRequest,
    fetch: fetchFn,
    handleNodeRequest,
    requestListener,
    handleEvent,
    handle: genericRequestHandler,
  };

  return new Proxy(genericRequestHandler as any, {
    // It should have all the attributes of the handler function and the server instance
    has: (_, prop) => {
      return (serverAdapterBaseObject && prop in serverAdapterBaseObject) || prop in adapterObj || prop in genericRequestHandler;
    },
    get: (_, prop) => {
      if (prop in serverAdapterBaseObject) {
        if (serverAdapterBaseObject[prop].bind) {
          return serverAdapterBaseObject[prop].bind(serverAdapterBaseObject);
        }
        return serverAdapterBaseObject[prop];
      }
      if (adapterObj[prop]) {
        if (adapterObj[prop].bind) {
          return adapterObj[prop].bind(adapterObj);
        }
        return adapterObj[prop];
      }
      if (genericRequestHandler[prop]) {
        if (genericRequestHandler[prop].bind) {
          return genericRequestHandler[prop].bind(genericRequestHandler);
        }
        return genericRequestHandler[prop];
      }
    },
    apply(_, __, [input, ctx]: Parameters<typeof genericRequestHandler>) {
      return genericRequestHandler(input, ctx);
    },
  });
}
