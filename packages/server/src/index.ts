import type { RequestListener, ServerResponse } from 'node:http';
import {
  isFetchEvent,
  isNodeRequest,
  isRequestInit,
  isServerResponse,
  NodeRequest,
  normalizeNodeRequest,
  sendNodeResponse,
} from './utils';
import { Request as PonyfillRequestCtor } from '@whatwg-node/fetch';
import { FetchEvent } from './types';

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
  handleNodeRequest(nodeRequest: NodeRequest, ...ctx: Partial<TServerContext>[]): Promise<Response> | Response;
  /**
   * A request listener function that can be used with any Node server variation.
   */
  requestListener: RequestListener;

  handle(req: NodeRequest, res: ServerResponse, ...ctx: Partial<TServerContext>[]): Promise<void>;
  handle(request: Request, ...ctx: Partial<TServerContext>[]): Promise<Response> | Response;
  handle(fetchEvent: FetchEvent & Partial<TServerContext>, ...ctx: Partial<TServerContext>[]): void;
  handle(
    container: { request: Request } & Partial<TServerContext>,
    ...ctx: Partial<TServerContext>[]
  ): Promise<Response> | Response;
}

export type ServerAdapter<TServerContext, TBaseObject extends ServerAdapterBaseObject<TServerContext>> = TBaseObject &
  ServerAdapterObject<TServerContext, TBaseObject>['handle'] &
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

  function handleNodeRequest(nodeRequest: NodeRequest, ...ctx: Partial<TServerContext>[]) {
    const serverContext = ctx.length > 1 ? Object.assign({}, ...ctx) : ctx[0];
    const request = normalizeNodeRequest(nodeRequest, RequestCtor);
    return handleRequest(request, serverContext);
  }

  async function requestListener(
    nodeRequest: NodeRequest,
    serverResponse: ServerResponse,
    ...ctx: Partial<TServerContext>[]
  ) {
    const waitUntilPromises: Promise<unknown>[] = [];
    const defaultServerContext = {
      req: nodeRequest,
      res: serverResponse,
      waitUntil(p: Promise<unknown>) {
        waitUntilPromises.push(p);
      },
    };
    const response = await handleNodeRequest(nodeRequest, defaultServerContext as any, ...ctx);
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

  function handleEvent(event: FetchEvent, ...ctx: Partial<TServerContext>[]): void {
    if (!event.respondWith || !event.request) {
      throw new TypeError(`Expected FetchEvent, got ${event}`);
    }
    const serverContext = ctx.length > 0 ? Object.assign({}, event, ...ctx) : event;
    const response$ = handleRequest(event.request, serverContext);
    event.respondWith(response$);
  }

  function handleRequestWithWaitUntil(request: Request, ...ctx: Partial<TServerContext>[]) {
    const serverContext: TServerContext & object = ctx.length > 1 ? Object.assign({}, ...ctx) : ctx[0] || {};
    if (!('waitUntil' in serverContext)) {
      const waitUntilPromises: Promise<unknown>[] = [];
      const response$ = handleRequest(request, {
        ...serverContext,
        waitUntil(p: Promise<unknown>) {
          waitUntilPromises.push(p);
        },
      });
      if (waitUntilPromises.length > 0) {
        return handleWaitUntils(waitUntilPromises).then(() => response$);
      }
      return response$;
    }
    return handleRequest(request, serverContext);
  }

  const fetchFn: ServerAdapterObject<TServerContext, TBaseObject>['fetch'] = (
    input,
    ...maybeCtx: Partial<TServerContext>[]
  ) => {
    if (typeof input === 'string' || input instanceof URL) {
      const [initOrCtx, ...restOfCtx] = maybeCtx;
      if (isRequestInit(initOrCtx)) {
        return handleRequestWithWaitUntil(new RequestCtor(input, initOrCtx), ...restOfCtx);
      }
      return handleRequestWithWaitUntil(new RequestCtor(input), ...maybeCtx);
    }
    return handleRequestWithWaitUntil(input, ...maybeCtx);
  };

  const genericRequestHandler = (
    input: Request | FetchEvent | NodeRequest | ({ request: Request } & Partial<TServerContext>),
    ...maybeCtx: Partial<TServerContext>[]
  ): Promise<Response> | Response | Promise<void> | void => {
    // If it is a Node request
    const [initOrCtxOrRes, ...restOfCtx] = maybeCtx;
    if (isNodeRequest(input)) {
      if (!isServerResponse(initOrCtxOrRes)) {
        throw new TypeError(`Expected ServerResponse, got ${initOrCtxOrRes}`);
      }
      return requestListener(input, initOrCtxOrRes, ...restOfCtx);
    }

    if (isServerResponse(initOrCtxOrRes)) {
      throw new TypeError('Got Node response without Node request');
    }

    // Is input a container object over Request?
    if (typeof input === 'object' && 'request' in input) {
      // Is it FetchEvent?
      if (isFetchEvent(input)) {
        return handleEvent(input, ...maybeCtx);
      }
      // In this input is also the context
      return handleRequestWithWaitUntil(input.request, input, ...maybeCtx);
    }

    // Or is it Request itself?
    // Then ctx is present and it is the context
    return fetchFn(input, ...maybeCtx);
  };

  const adapterObj: ServerAdapterObject<TServerContext, TBaseObject> = {
    handleRequest,
    fetch: fetchFn,
    handleNodeRequest,
    requestListener,
    handleEvent,
    handle: genericRequestHandler as ServerAdapterObject<TServerContext, TBaseObject>['handle'],
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
    apply(_, __, args: Parameters<ServerAdapterObject<TServerContext, TBaseObject>['handle']>) {
      return genericRequestHandler(...args);
    },
  }) as any; // 😡
}

export { createServerAdapter };
