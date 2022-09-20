/// <reference lib="webworker" />

import type { RequestListener, ServerResponse } from 'node:http';
import { isReadable, isServerResponse, NodeRequest, normalizeNodeRequest, sendNodeResponse } from './utils';
import { Request as PonyfillRequestCtor } from '@whatwg-node/fetch';

export interface ServerAdapterBaseObject<
  TServerContext,
  THandleRequest extends ServerAdapterRequestHandler<TServerContext> = ServerAdapterRequestHandler<TServerContext>
> {
  /**
   * An async function that takes `Request` and the server context and returns a `Response`.
   * If you use `requestListener`, the server context is `{ req: IncomingMessage, res: ServerResponse }`.
   */
  handle: THandleRequest;
}

export interface ServerAdapterObject<
  TServerContext,
  TBaseObject extends ServerAdapterBaseObject<TServerContext, ServerAdapterRequestHandler<TServerContext>>
> extends EventListenerObject {
  /**
   * A basic request listener that takes a `Request` with the server context and returns a `Response`.
   */
  handleRequest: TBaseObject['handle'];
  /**
   * WHATWG Fetch spec compliant `fetch` function that can be used for testing purposes.
   */
  fetch(request: Request, ...ctx: any[]): Promise<Response> | Response;
  fetch(urlStr: string, ...ctx: any[]): Promise<Response> | Response;
  fetch(urlStr: string, init: RequestInit, ...ctx: any[]): Promise<Response> | Response;
  fetch(url: URL, ...ctx: any[]): Promise<Response> | Response;
  fetch(url: URL, init: RequestInit, ...ctx: any[]): Promise<Response> | Response;

  /**
   * This function takes Node's request object and returns a WHATWG Fetch spec compliant `Response` object.
   **/
  handleNodeRequest(nodeRequest: NodeRequest, serverContext: TServerContext): Promise<Response> | Response;
  /**
   * A request listener function that can be used with any Node server variation.
   */
  requestListener: RequestListener;
  /**
   * Proxy to requestListener to mimic Node middlewares
   */
  handle: RequestListener & ServerAdapterObject<TServerContext, TBaseObject>['fetch'];
}

export type ServerAdapter<TServerContext, TBaseObject extends ServerAdapterBaseObject<TServerContext>> = TBaseObject &
  RequestListener &
  ServerAdapterObject<TServerContext, TBaseObject>['fetch'] &
  ServerAdapterObject<TServerContext, TBaseObject>;

async function handleWaitUntils(waitUntilPromises: Promise<unknown>[]) {
  const waitUntils = await Promise.allSettled(waitUntilPromises);
  waitUntils.forEach(waitUntil => {
    if (waitUntil.status === 'rejected') {
      console.error(waitUntil.reason);
    }
  });
}

export type ServerAdapterRequestHandler<TServerContext> = (
  request: Request,
  serverContext: TServerContext
) => Promise<Response> | Response;

export type DefaultServerAdapterContext = {
  req: NodeRequest;
  res: ServerResponse;
  waitUntil(promise: Promise<unknown>): void;
};

function createServerAdapter<
  TServerContext = DefaultServerAdapterContext,
  THandleRequest extends ServerAdapterRequestHandler<TServerContext> = ServerAdapterRequestHandler<TServerContext>
>(
  serverAdapterRequestHandler: THandleRequest,
  RequestCtor?: typeof Request
): ServerAdapter<TServerContext, ServerAdapterBaseObject<TServerContext, THandleRequest>>;
function createServerAdapter<TServerContext, TBaseObject extends ServerAdapterBaseObject<TServerContext>>(
  serverAdapterBaseObject: TBaseObject,
  RequestCtor?: typeof Request
): ServerAdapter<TServerContext, TBaseObject>;
function createServerAdapter<
  TServerContext = DefaultServerAdapterContext,
  THandleRequest extends ServerAdapterRequestHandler<TServerContext> = ServerAdapterRequestHandler<TServerContext>,
  TBaseObject extends ServerAdapterBaseObject<TServerContext, THandleRequest> = ServerAdapterBaseObject<
    TServerContext,
    THandleRequest
  >
>(
  serverAdapterBaseObject: TBaseObject | THandleRequest,
  /**
   * WHATWG Fetch spec compliant `Request` constructor.
   */
  RequestCtor = PonyfillRequestCtor
): ServerAdapter<TServerContext, TBaseObject> {
  const handleRequest =
    typeof serverAdapterBaseObject === 'function' ? serverAdapterBaseObject : serverAdapterBaseObject.handle;

  function handleNodeRequest(nodeRequest: NodeRequest, serverContext: TServerContext) {
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

  function handleRequestWithWaitUntil(request: Request, ctx: any = {}, ...rest: any[]) {
    if ('process' in globalThis && process.versions?.['bun'] != null) {
      // This is required for bun
      request.text();
    }
    if (rest?.length > 0) {
      ctx = Object.assign({}, ctx, ...rest);
    }
    if (!ctx.waitUntil) {
      const waitUntilPromises: Promise<unknown>[] = [];
      ctx.waitUntil = (p: Promise<unknown>) => {
        waitUntilPromises.push(p);
      };
      const response$ = handleRequest(request, {
        ...ctx,
        waitUntil(p: Promise<unknown>) {
          waitUntilPromises.push(p);
        },
      });
      if (waitUntilPromises.length > 0) {
        return handleWaitUntils(waitUntilPromises).then(() => response$);
      }
    }
    return handleRequest(request, ctx);
  }

  function genericRequestHandler(input: any, ctx: any, ...rest: any[]) {
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
      return handleRequestWithWaitUntil(input.request, input, ...rest);
    }
    // Or is it Request itself?
    // Then ctx is present and it is the context
    return handleRequestWithWaitUntil(input, ctx, ...rest);
  }

  function fetchFn(input: RequestInfo | URL, init?: RequestInit, ...ctx: any[]) {
    if (typeof input === 'string' || input instanceof URL) {
      return handleRequestWithWaitUntil(new RequestCtor(input, init), Object.assign({}, ...ctx));
    }
    return handleRequestWithWaitUntil(input, Object.assign({}, init, ...ctx));
  }

  const adapterObj: ServerAdapterObject<TServerContext, TBaseObject> = {
    handleRequest,
    fetch: fetchFn,
    handleNodeRequest,
    requestListener,
    handleEvent,
    handle: genericRequestHandler as any,
  };

  return new Proxy(genericRequestHandler as any, {
    // It should have all the attributes of the handler function and the server instance
    has: (_, prop) => {
      return (
        prop in adapterObj ||
        prop in genericRequestHandler ||
        (serverAdapterBaseObject && prop in serverAdapterBaseObject)
      );
    },
    get: (_, prop) => {
      const adapterProp = adapterObj[prop];
      if (adapterProp) {
        if (adapterProp.bind) {
          return adapterProp.bind(adapterObj);
        }
        return adapterProp;
      }
      const genericRequestHandlerProp: any = genericRequestHandler[prop];
      if (genericRequestHandlerProp) {
        if (genericRequestHandlerProp.bind) {
          return genericRequestHandlerProp.bind(genericRequestHandler);
        }
        return genericRequestHandlerProp;
      }
      if (serverAdapterBaseObject) {
        const serverAdapterBaseObjectProp = serverAdapterBaseObject[prop];
        if (serverAdapterBaseObjectProp) {
          if (serverAdapterBaseObjectProp.bind) {
            return serverAdapterBaseObjectProp.bind(serverAdapterBaseObject);
          }
          return serverAdapterBaseObjectProp;
        }
      }
    },
    apply(_, __, [input, ctx]: Parameters<typeof genericRequestHandler>) {
      return genericRequestHandler(input, ctx);
    },
  });
}

export { createServerAdapter };
