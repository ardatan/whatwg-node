import {
  isFetchEvent,
  isNodeRequest,
  isRequestInit,
  isServerResponse,
  NodeRequest,
  NodeResponse,
  normalizeNodeRequest,
  sendNodeResponse,
} from './utils';
import { Request as PonyfillRequestCtor } from '@whatwg-node/fetch';
import {
  DefaultServerAdapterContext,
  FetchEvent,
  ServerAdapter,
  ServerAdapterBaseObject,
  ServerAdapterObject,
  ServerAdapterRequestHandler,
} from './types';

async function handleWaitUntils(waitUntilPromises: Promise<unknown>[]) {
  const waitUntils = await Promise.allSettled(waitUntilPromises);
  waitUntils.forEach(waitUntil => {
    if (waitUntil.status === 'rejected') {
      console.error(waitUntil.reason);
    }
  });
}

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
    serverResponse: NodeResponse,
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
      await new Promise<void>(resolve => {
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
