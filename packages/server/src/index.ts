/// <reference lib="webworker" />

import type { RequestListener, ServerResponse } from 'node:http';
import { isReadable, isServerResponse, NodeRequest, normalizeNodeRequest, sendNodeResponse } from './utils';
import { Request as PonyfillRequestCtor } from '@whatwg-node/fetch';

export interface CreateServerAdapterOptions<TServerContext, TBaseObject> {
  /**
   * WHATWG Fetch spec compliant `Request` constructor.
   */
  Request?: typeof Request;
  /**
   * An async function that takes `Request` and the server context and returns a `Response`.
   * If you use `requestListener`, the server context is `{ req: IncomingMessage, res: ServerResponse }`.
   */
  handleRequest: (request: Request, serverContext: TServerContext) => Promise<Response>;
  /**
   * If you extend a server object with this, you can pass the original object and it will be extended with the required methods and functionalities.
   */
  baseObject?: TBaseObject;
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
  handle: RequestListener;
}

export type ServerAdapter<TServerContext, TBaseObject> = TBaseObject &
  RequestListener & ServerAdapterObject<TServerContext>['fetch'] &
  ServerAdapterObject<TServerContext>;

export function createServerAdapter<
  TServerContext = {
    req: NodeRequest;
    res: ServerResponse;
  },
  TBaseObject = unknown
>({
  Request: RequestCtor = PonyfillRequestCtor,
  handleRequest,
  baseObject,
}: CreateServerAdapterOptions<TServerContext, TBaseObject>): ServerAdapter<TServerContext, TBaseObject> {
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
    const response = await handleNodeRequest(nodeRequest, {
      req: nodeRequest,
      res: serverResponse,
      waitUntil(p: Promise<any>) {
        p.catch(err => console.error(err));
      },
    } as any);
    return sendNodeResponse(response, serverResponse);
  }

  function handleEvent(event: FetchEvent) {
    if (!event.respondWith || !event.request) {
      throw new TypeError(`Expected FetchEvent, got ${event}`);
    }
    const response$ = handleRequest(event.request, event as any);
    event.respondWith(response$);
  }

  const adapterObj: ServerAdapterObject<TServerContext> = {
    handleRequest,
    fetch: fetchFn,
    handleNodeRequest,
    requestListener,
    handleEvent,
    handle: requestListener,
  };

  function genericRequestHandler(input: any, ctx: any) {
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
    return handleRequest(input, ctx);
  }

  return new Proxy(genericRequestHandler as any, {
    // It should have all the attributes of the handler function and the server instance
    has: (_, prop) => {
      return (baseObject && prop in baseObject) || prop in adapterObj || prop in genericRequestHandler;
    },
    get: (_, prop) => {
      if (baseObject) {
        if (prop in baseObject) {
          if (baseObject[prop].bind) {
            return baseObject[prop].bind(baseObject);
          }
          return baseObject[prop];
        }
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
