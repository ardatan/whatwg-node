/* eslint-disable @typescript-eslint/ban-types */
import * as DefaultFetchAPI from '@whatwg-node/fetch';
import {
  OnRequestHook,
  OnResponseEventPayload,
  OnResponseHook,
  ServerAdapterPlugin,
} from './plugins/types.js';
import {
  FetchAPI,
  FetchEvent,
  ServerAdapter,
  ServerAdapterBaseObject,
  ServerAdapterObject,
  ServerAdapterRequestHandler,
} from './types.js';
import {
  completeAssign,
  handleErrorFromRequestHandler,
  isFetchEvent,
  isNodeRequest,
  isPromise,
  isRequestInit,
  isServerResponse,
  iterateAsyncVoid,
  NodeRequest,
  NodeResponse,
  normalizeNodeRequest,
  sendNodeResponse,
  ServerAdapterRequestAbortSignal,
} from './utils.js';
import {
  getRequestFromUWSRequest,
  isUWSResponse,
  sendResponseToUwsOpts,
  type UWSRequest,
  type UWSResponse,
} from './uwebsockets.js';

async function handleWaitUntils(waitUntilPromises: Promise<unknown>[]) {
  const waitUntils = await Promise.allSettled(waitUntilPromises);
  waitUntils.forEach(waitUntil => {
    if (waitUntil.status === 'rejected') {
      console.error(waitUntil.reason);
    }
  });
}

type RequestContainer = { request: Request };

// Required for envs like nextjs edge runtime
function isRequestAccessible(serverContext: any): serverContext is RequestContainer {
  try {
    return !!serverContext?.request;
  } catch {
    return false;
  }
}

function addWaitUntil(serverContext: any, waitUntilPromises: Promise<unknown>[]): void {
  serverContext['waitUntil'] = function (promise: Promise<void> | void) {
    if (promise != null) {
      waitUntilPromises.push(promise);
    }
  };
}

export interface ServerAdapterOptions<TServerContext> {
  plugins?: ServerAdapterPlugin<TServerContext>[];
  fetchAPI?: Partial<FetchAPI>;
}

const EMPTY_OBJECT = {};

function createServerAdapter<
  TServerContext = {},
  THandleRequest extends
    ServerAdapterRequestHandler<TServerContext> = ServerAdapterRequestHandler<TServerContext>,
>(
  serverAdapterRequestHandler: THandleRequest,
  options?: ServerAdapterOptions<TServerContext>,
): ServerAdapter<TServerContext, ServerAdapterBaseObject<TServerContext, THandleRequest>>;
function createServerAdapter<
  TServerContext,
  TBaseObject extends ServerAdapterBaseObject<TServerContext>,
>(
  serverAdapterBaseObject: TBaseObject,
  options?: ServerAdapterOptions<TServerContext>,
): ServerAdapter<TServerContext, TBaseObject>;
function createServerAdapter<
  TServerContext = {},
  THandleRequest extends
    ServerAdapterRequestHandler<TServerContext> = ServerAdapterRequestHandler<TServerContext>,
  TBaseObject extends ServerAdapterBaseObject<
    TServerContext,
    THandleRequest
  > = ServerAdapterBaseObject<TServerContext, THandleRequest>,
>(
  serverAdapterBaseObject: TBaseObject | THandleRequest,
  options?: ServerAdapterOptions<TServerContext>,
): ServerAdapter<TServerContext, TBaseObject> {
  const fetchAPI = {
    ...DefaultFetchAPI,
    ...options?.fetchAPI,
  };
  const givenHandleRequest =
    typeof serverAdapterBaseObject === 'function'
      ? serverAdapterBaseObject
      : serverAdapterBaseObject.handle;

  const onRequestHooks: OnRequestHook<TServerContext>[] = [];
  const onResponseHooks: OnResponseHook<TServerContext>[] = [];

  if (options?.plugins != null) {
    for (const plugin of options.plugins) {
      if (plugin.onRequest) {
        onRequestHooks.push(plugin.onRequest);
      }
      if (plugin.onResponse) {
        onResponseHooks.push(plugin.onResponse);
      }
    }
  }

  const handleRequest: ServerAdapterRequestHandler<TServerContext> =
    onRequestHooks.length > 0 || onResponseHooks.length > 0
      ? function handleRequest(request: Request, serverContext: TServerContext) {
          let requestHandler: ServerAdapterRequestHandler<any> = givenHandleRequest;
          let response: Response | undefined;
          if (onRequestHooks.length === 0) {
            return handleEarlyResponse();
          }
          let url = new Proxy(EMPTY_OBJECT as URL, {
            get(_target, prop, _receiver) {
              url = new fetchAPI.URL(request.url, 'http://localhost');
              return Reflect.get(url, prop, url);
            },
          }) as URL;
          const onRequestHooksIteration$ = iterateAsyncVoid(
            onRequestHooks,
            (onRequestHook, stopEarly) =>
              onRequestHook({
                request,
                serverContext,
                fetchAPI,
                url,
                requestHandler,
                setRequestHandler(newRequestHandler) {
                  requestHandler = newRequestHandler;
                },
                endResponse(newResponse) {
                  response = newResponse;
                  if (newResponse) {
                    stopEarly();
                  }
                },
              }),
          );
          function handleResponse(response: Response) {
            if (onRequestHooks.length === 0) {
              return response;
            }
            const onResponseHookPayload: OnResponseEventPayload<TServerContext> = {
              request,
              response,
              serverContext,
            };
            const onResponseHooksIteration$ = iterateAsyncVoid(onResponseHooks, onResponseHook =>
              onResponseHook(onResponseHookPayload),
            );
            if (isPromise(onResponseHooksIteration$)) {
              return onResponseHooksIteration$.then(() => response);
            }
            return response;
          }
          function handleEarlyResponse() {
            if (!response) {
              const response$ = requestHandler(request, serverContext);
              if (isPromise(response$)) {
                return response$.then(handleResponse);
              }
              return handleResponse(response$);
            }
            return handleResponse(response);
          }
          if (isPromise(onRequestHooksIteration$)) {
            return onRequestHooksIteration$.then(handleEarlyResponse);
          }
          return handleEarlyResponse();
        }
      : givenHandleRequest;

  function handleNodeRequest(nodeRequest: NodeRequest, ...ctx: Partial<TServerContext>[]) {
    const serverContext = ctx.length > 1 ? completeAssign(...ctx) : ctx[0] || {};
    let request: Request = new Proxy(EMPTY_OBJECT as Request, {
      get(_target, prop, _receiver) {
        request = normalizeNodeRequest(nodeRequest, fetchAPI.Request);
        return Reflect.get(request, prop, request);
      },
    });
    return handleRequest(request, serverContext);
  }

  function requestListener(
    nodeRequest: NodeRequest,
    serverResponse: NodeResponse,
    ...ctx: Partial<TServerContext>[]
  ) {
    const waitUntilPromises: Promise<unknown>[] = [];
    const defaultServerContext = {
      req: nodeRequest,
      res: serverResponse,
    };
    addWaitUntil(defaultServerContext, waitUntilPromises);
    let response$: Response | Promise<Response> | undefined;
    try {
      response$ = handleNodeRequest(nodeRequest, defaultServerContext as any, ...ctx);
    } catch (err: any) {
      response$ = handleErrorFromRequestHandler(err, fetchAPI.Response);
    }
    if (isPromise(response$)) {
      return response$
        .catch((e: any) => handleErrorFromRequestHandler(e, fetchAPI.Response))
        .then(response => sendNodeResponse(response, serverResponse, nodeRequest))
        .catch(err => {
          console.error(`Unexpected error while handling request: ${err.message || err}`);
        });
    }
    try {
      return sendNodeResponse(response$, serverResponse, nodeRequest);
    } catch (err: any) {
      console.error(`Unexpected error while handling request: ${err.message || err}`);
    }
  }

  function handleUWS(res: UWSResponse, req: UWSRequest, ...ctx: Partial<TServerContext>[]) {
    const waitUntilPromises: Promise<unknown>[] = [];
    const defaultServerContext = {
      res,
      req,
    };
    addWaitUntil(defaultServerContext, waitUntilPromises);
    const serverContext =
      ctx.length > 0 ? completeAssign(defaultServerContext, ...ctx) : defaultServerContext;
    const request = getRequestFromUWSRequest({
      req,
      res,
      fetchAPI,
    });
    let resAborted = false;
    res.onAborted(() => {
      resAborted = true;
      (request.signal as ServerAdapterRequestAbortSignal).sendAbort();
    });
    let response$: Response | Promise<Response> | undefined;
    try {
      response$ = handleRequest(request, serverContext);
    } catch (err: any) {
      response$ = handleErrorFromRequestHandler(err, fetchAPI.Response);
    }
    if (isPromise(response$)) {
      return response$
        .catch((e: any) => handleErrorFromRequestHandler(e, fetchAPI.Response))
        .then(response => {
          if (!resAborted) {
            return sendResponseToUwsOpts(res, response);
          }
        })
        .catch(err => {
          console.error(`Unexpected error while handling request: ${err.message || err}`);
        });
    }
    try {
      return sendResponseToUwsOpts(res, response$);
    } catch (err: any) {
      console.error(`Unexpected error while handling request: ${err.message || err}`);
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
    const serverContext = (ctx.length > 1 ? completeAssign(...ctx) : ctx[0]) || {};
    if (serverContext.waitUntil == null) {
      const waitUntilPromises: Promise<void>[] = [];
      addWaitUntil(serverContext, waitUntilPromises);
      const response$ = handleRequest(request, serverContext);
      if (waitUntilPromises.length > 0) {
        return handleWaitUntils(waitUntilPromises).then(() => response$);
      }
      return response$;
    }
    return handleRequest(request, serverContext);
  }

  const fetchFn: ServerAdapterObject<TServerContext>['fetch'] = (
    input,
    ...maybeCtx: Partial<TServerContext>[]
  ) => {
    if (typeof input === 'string' || 'href' in input) {
      const [initOrCtx, ...restOfCtx] = maybeCtx;
      if (isRequestInit(initOrCtx)) {
        return handleRequestWithWaitUntil(new fetchAPI.Request(input, initOrCtx), ...restOfCtx);
      }
      return handleRequestWithWaitUntil(new fetchAPI.Request(input), ...maybeCtx);
    }
    return handleRequestWithWaitUntil(input, ...maybeCtx);
  };

  const genericRequestHandler = (
    input:
      | Request
      | FetchEvent
      | NodeRequest
      | ({ request: Request } & Partial<TServerContext>)
      | UWSResponse,
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

    if (isUWSResponse(input)) {
      return handleUWS(input, initOrCtxOrRes as any, ...restOfCtx);
    }

    if (isServerResponse(initOrCtxOrRes)) {
      throw new TypeError('Got Node response without Node request');
    }

    // Is input a container object over Request?
    if (isRequestAccessible(input)) {
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

  const adapterObj: ServerAdapterObject<TServerContext> = {
    handleRequest,
    fetch: fetchFn,
    handleNodeRequest,
    requestListener,
    handleEvent,
    handleUWS,
    handle: genericRequestHandler as ServerAdapterObject<TServerContext>['handle'],
  };

  const serverAdapter = new Proxy(genericRequestHandler, {
    // It should have all the attributes of the handler function and the server instance
    has: (_, prop) => {
      return (
        prop in adapterObj ||
        prop in genericRequestHandler ||
        (serverAdapterBaseObject && prop in serverAdapterBaseObject)
      );
    },
    get: (_, prop) => {
      const adapterProp = (adapterObj as any)[prop];
      if (adapterProp) {
        if (adapterProp.bind) {
          return adapterProp.bind(adapterObj);
        }
        return adapterProp;
      }
      const handleProp = (genericRequestHandler as any)[prop];
      if (handleProp) {
        if (handleProp.bind) {
          return handleProp.bind(genericRequestHandler);
        }
        return handleProp;
      }
      if (serverAdapterBaseObject) {
        const serverAdapterBaseObjectProp = (serverAdapterBaseObject as any)[prop];
        if (serverAdapterBaseObjectProp) {
          if (serverAdapterBaseObjectProp.bind) {
            return function (...args: any[]) {
              const returnedVal = (serverAdapterBaseObject as any)[prop](...args);
              if (returnedVal === serverAdapterBaseObject) {
                return serverAdapter;
              }
              return returnedVal;
            };
          }
          return serverAdapterBaseObjectProp;
        }
      }
    },
    apply(_, __, args: Parameters<ServerAdapterObject<TServerContext>['handle']>) {
      return genericRequestHandler(...args);
    },
  });
  return serverAdapter as any;
}

export { createServerAdapter };
