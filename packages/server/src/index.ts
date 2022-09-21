/// <reference lib="webworker" />

import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  isReadable,
  isRequestInit,
  isServerResponse,
  NodeRequest,
  normalizeNodeRequest,
  sendNodeResponse,
} from './utils';
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
  fetch(request: Request, ctx: TServerContext): Promise<Response> | Response;
  fetch(request: Request, ...ctx: Partial<TServerContext>[]): Promise<Response> | Response;
  fetch(urlStr: string, ctx: TServerContext): Promise<Response> | Response;
  fetch(urlStr: string, ...ctx: Partial<TServerContext>[]): Promise<Response> | Response;
  fetch(urlStr: string, init: RequestInit, ctx: TServerContext): Promise<Response> | Response;
  fetch(urlStr: string, init: RequestInit, ...ctx: Partial<TServerContext>[]): Promise<Response> | Response;
  fetch(url: URL, ctx: TServerContext): Promise<Response> | Response;
  fetch(url: URL, ...ctx: Partial<TServerContext>[]): Promise<Response> | Response;
  fetch(url: URL, init: RequestInit, ctx: TServerContext): Promise<Response> | Response;
  fetch(url: URL, init: RequestInit, ...ctx: Partial<TServerContext>[]): Promise<Response> | Response;
  /**
   * This function takes Node's request object and returns a WHATWG Fetch spec compliant `Response` object.
   **/
  handleNodeRequest(nodeRequest: NodeRequest, ctx: TServerContext): Promise<Response> | Response;
  /**
   * A request listener function that can be used with any Node server variation.
   */
  requestListener(req: IncomingMessage, res: ServerResponse, ctx: TServerContext): void;
  requestListener(req: IncomingMessage, res: ServerResponse, ...ctx: Partial<TServerContext>[]): void;
  /**
   * Proxy to requestListener to mimic Node middlewares
   */
  handle: ServerAdapterObject<TServerContext, TBaseObject>['requestListener'] &
    ServerAdapterObject<TServerContext, TBaseObject>['fetch'];
}

export type ServerAdapter<TServerContext, TBaseObject extends ServerAdapterBaseObject<TServerContext>> = TBaseObject &
  ServerAdapterObject<TServerContext, TBaseObject>['requestListener'] &
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
  ctx: TServerContext
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

  function handleNodeRequest(nodeRequest: NodeRequest, ctx: TServerContext) {
    const request = normalizeNodeRequest(nodeRequest, RequestCtor);
    return handleRequest(request, ctx);
  }

  async function requestListener(
    nodeRequest: NodeRequest,
    serverResponse: ServerResponse,
    ...ctx: Partial<TServerContext>[]
  ) {
    const waitUntilPromises: Promise<unknown>[] = [];
    let serverContext = {} as TServerContext;
    if (ctx?.length > 0) {
      serverContext = Object.assign({}, serverContext, ...ctx);
    }
    const response = await handleNodeRequest(nodeRequest, {
      ...serverContext,
      req: nodeRequest,
      res: serverResponse,
      waitUntil(p) {
        waitUntilPromises.push(p);
      },
    } as TServerContext & DefaultServerAdapterContext);
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
    return response;
  }

  function handleEvent(event: FetchEvent, ...ctx: Partial<TServerContext>[]) {
    if (!event.respondWith || !event.request) {
      throw new TypeError(`Expected FetchEvent, got ${event}`);
    }
    let serverContext = {} as TServerContext;
    if (ctx?.length > 0) {
      serverContext = Object.assign({}, serverContext, ...ctx);
    }
    const response$ = handleRequest(event.request, serverContext);
    event.respondWith(response$);
    return response$;
  }

  function handleRequestWithWaitUntil(request: Request, ctx: TServerContext) {
    const extendedCtx = ctx as TServerContext & { waitUntil?: (p: Promise<unknown>) => void };
    if ('process' in globalThis && process.versions?.['bun'] != null) {
      // This is required for bun
      request.text();
    }
    if (!extendedCtx.waitUntil) {
      const waitUntilPromises: Promise<unknown>[] = [];
      extendedCtx.waitUntil = (p: Promise<unknown>) => {
        waitUntilPromises.push(p);
      };
      const response$ = handleRequest(request, {
        ...extendedCtx,
        waitUntil(p: Promise<unknown>) {
          waitUntilPromises.push(p);
        },
      });
      if (waitUntilPromises.length > 0) {
        return handleWaitUntils(waitUntilPromises).then(() => response$);
      }
      return response$;
    }
    return handleRequest(request, extendedCtx);
  }

  const fetchFn: ServerAdapterObject<TServerContext, TBaseObject>['fetch'] = (
    input,
    initOrCtx,
    ...ctx: Partial<TServerContext>[]
  ) => {
    let init;
    let serverContext = {} as TServerContext;
    if (isRequestInit(initOrCtx)) {
      init = initOrCtx;
    } else {
      init = {};
      serverContext = Object.assign({}, serverContext, initOrCtx);
    }
    if (ctx?.length > 0) {
      serverContext = Object.assign({}, serverContext, ...ctx);
    }
    if (typeof input === 'string' || input instanceof URL) {
      return handleRequestWithWaitUntil(new RequestCtor(input, init), serverContext);
    }
    return handleRequestWithWaitUntil(input, serverContext);
  };

  const genericRequestHandler: ServerAdapterObject<TServerContext, TBaseObject>['handle'] = (
    input,
    initOrCtxOrRes,
    ...ctx: Partial<TServerContext>[]
  ) => {
    // If it is a Node request
    if (isReadable(input) && isServerResponse(initOrCtxOrRes)) {
      return requestListener(input, initOrCtxOrRes, ...ctx);
    }
    if (isServerResponse(initOrCtxOrRes)) {
      throw new Error('Got Node response without Node request');
    }

    // Is input a container object over Request?
    if (typeof input === 'object' && 'request' in input) {
      // Is it FetchEvent?
      if ('respondWith' in input) {
        return handleEvent(input, isRequestInit(initOrCtxOrRes) ? {} : initOrCtxOrRes, ...ctx);
      }
      // In this input is also the context
      return fetchFn(
        // @ts-expect-error input can indeed be a Request
        (input as any as { request: Request }).request,
        initOrCtxOrRes,
        ...ctx
      );
    }

    // Or is it Request itself?
    // Then ctx is present and it is the context
    return fetchFn(
      // @ts-expect-error input can indeed string | Request | URL
      input,
      initOrCtxOrRes,
      ...ctx
    );
  };

  const adapterObj: ServerAdapterObject<TServerContext, TBaseObject> = {
    handleRequest,
    fetch: fetchFn,
    handleNodeRequest,
    requestListener,
    handleEvent,
    handle: genericRequestHandler,
  };

  return new Proxy(genericRequestHandler, {
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
      const handleProp = genericRequestHandler[prop];
      if (handleProp) {
        if (handleProp.bind) {
          return handleProp.bind(genericRequestHandler);
        }
        return handleProp;
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
  }) as any; // 😡
}

export { createServerAdapter };
