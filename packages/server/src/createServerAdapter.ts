/* eslint-disable @typescript-eslint/ban-types */
import { AsyncDisposableStack, DisposableSymbols } from '@whatwg-node/disposablestack';
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
  type ServerAdapterInitialContext,
} from './types.js';
import {
  completeAssign,
  ensureDisposableStackRegisteredForTerminateEvents,
  handleAbortSignalAndPromiseResponse,
  handleErrorFromRequestHandler,
  isFetchEvent,
  isNodeRequest,
  isolateObject,
  isPromise,
  isRequestInit,
  isServerResponse,
  iterateAsyncVoid,
  NodeRequest,
  nodeRequestResponseMap,
  NodeResponse,
  normalizeNodeRequest,
  sendNodeResponse,
  ServerAdapterRequestAbortSignal,
} from './utils.js';
import {
  fakePromise,
  getRequestFromUWSRequest,
  isUWSResponse,
  sendResponseToUwsOpts,
  type UWSRequest,
  type UWSResponse,
} from './uwebsockets.js';

type RequestContainer = { request: Request };

// Required for envs like nextjs edge runtime
function isRequestAccessible(serverContext: any): serverContext is RequestContainer {
  try {
    return !!serverContext?.request;
  } catch {
    return false;
  }
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

  const onRequestHooks: OnRequestHook<TServerContext & ServerAdapterInitialContext>[] = [];
  const onResponseHooks: OnResponseHook<TServerContext & ServerAdapterInitialContext>[] = [];
  const waitUntilPromises = new Set<PromiseLike<unknown>>();
  const disposableStack = new AsyncDisposableStack();
  const signals = new Set<ServerAdapterRequestAbortSignal>();

  function registerSignal(signal: ServerAdapterRequestAbortSignal) {
    signals.add(signal);
    signal.addEventListener('abort', () => {
      signals.delete(signal);
    });
  }

  disposableStack.defer(() => {
    for (const signal of signals) {
      signal.sendAbort();
    }
  });

  disposableStack.defer(() => {
    if (waitUntilPromises.size > 0) {
      return Promise.allSettled(waitUntilPromises).then(
        () => {},
        () => {},
      );
    }
  });

  function waitUntil(promiseLike: PromiseLike<unknown>) {
    // If it is a Node.js environment, we should register the disposable stack to handle process termination events
    if (globalThis.process) {
      ensureDisposableStackRegisteredForTerminateEvents(disposableStack);
    }
    waitUntilPromises.add(
      promiseLike.then(
        () => {
          waitUntilPromises.delete(promiseLike);
        },
        err => {
          console.error(`Unexpected error while waiting: ${err.message || err}`);
          waitUntilPromises.delete(promiseLike);
        },
      ),
    );
  }

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

  const handleRequest: ServerAdapterRequestHandler<TServerContext & ServerAdapterInitialContext> =
    onRequestHooks.length > 0 || onResponseHooks.length > 0
      ? function handleRequest(request, serverContext) {
          let requestHandler: ServerAdapterRequestHandler<any> = givenHandleRequest;
          let response: Response | undefined;
          if (onRequestHooks.length === 0) {
            return handleEarlyResponse();
          }
          let url =
            (request as any)['parsedUrl'] ||
            (new Proxy(EMPTY_OBJECT as URL, {
              get(_target, prop, _receiver) {
                url = new fetchAPI.URL(request.url, 'http://localhost');
                return Reflect.get(url, prop, url);
              },
            }) as URL);
          const onRequestHooksIteration$ = iterateAsyncVoid(
            onRequestHooks,
            (onRequestHook, stopEarly) =>
              onRequestHook({
                request,
                setRequest(newRequest) {
                  request = newRequest;
                },
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
            if (onResponseHooks.length === 0) {
              return response;
            }
            const onResponseHookPayload: OnResponseEventPayload<
              TServerContext & ServerAdapterInitialContext
            > = {
              request,
              response,
              serverContext,
              setResponse(newResponse) {
                response = newResponse;
              },
              fetchAPI,
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

  // TODO: Remove this on the next major version
  function handleNodeRequest(nodeRequest: NodeRequest, ...ctx: Partial<TServerContext>[]) {
    const serverContext = ctx.length > 1 ? completeAssign(...ctx) : ctx[0] || {};
    const request = normalizeNodeRequest(nodeRequest, fetchAPI, registerSignal);
    return handleRequest(request, serverContext);
  }

  function handleNodeRequestAndResponse(
    nodeRequest: NodeRequest,
    nodeResponseOrContainer: NodeResponse | { raw: NodeResponse },
    ...ctx: Partial<TServerContext>[]
  ) {
    const nodeResponse: NodeResponse =
      (nodeResponseOrContainer as any).raw || nodeResponseOrContainer;
    nodeRequestResponseMap.set(nodeRequest, nodeResponse);
    return handleNodeRequest(nodeRequest, ...ctx);
  }

  function requestListener(
    nodeRequest: NodeRequest,
    nodeResponse: NodeResponse,
    ...ctx: Partial<TServerContext>[]
  ) {
    const defaultServerContext = {
      req: nodeRequest,
      res: nodeResponse,
      waitUntil,
    };
    let response$: Response | Promise<Response> | undefined;
    try {
      response$ = handleNodeRequestAndResponse(
        nodeRequest,
        nodeResponse,
        defaultServerContext as any,
        ...ctx,
      );
    } catch (err: any) {
      response$ = handleErrorFromRequestHandler(err, fetchAPI.Response);
    }
    if (isPromise(response$)) {
      return response$
        .catch((e: any) => handleErrorFromRequestHandler(e, fetchAPI.Response))
        .then(response => sendNodeResponse(response, nodeResponse, nodeRequest))
        .catch(err => {
          console.error(`Unexpected error while handling request: ${err.message || err}`);
        });
    }
    try {
      return sendNodeResponse(response$, nodeResponse, nodeRequest);
    } catch (err: any) {
      console.error(`Unexpected error while handling request: ${err.message || err}`);
    }
  }

  function handleUWS(res: UWSResponse, req: UWSRequest, ...ctx: Partial<TServerContext>[]) {
    const defaultServerContext = {
      res,
      req,
      waitUntil,
    };
    const filteredCtxParts = ctx.filter(partCtx => partCtx != null);
    const serverContext =
      filteredCtxParts.length > 0
        ? completeAssign(defaultServerContext, ...ctx)
        : defaultServerContext;

    const signal = new ServerAdapterRequestAbortSignal();
    registerSignal(signal);
    const originalResEnd = res.end.bind(res);
    let resEnded = false;
    res.end = function (data: any) {
      resEnded = true;
      return originalResEnd(data);
    };
    const originalOnAborted = res.onAborted.bind(res);
    originalOnAborted(function () {
      signal.sendAbort();
    });
    res.onAborted = function (cb: () => void) {
      signal.addEventListener('abort', cb);
    };
    const request = getRequestFromUWSRequest({
      req,
      res,
      fetchAPI,
      signal,
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
          if (!signal.aborted && !resEnded) {
            return sendResponseToUwsOpts(res, response, signal, fetchAPI);
          }
        })
        .catch(err => {
          console.error(
            `Unexpected error while handling request: \n${err.stack || err.message || err}`,
          );
        });
    }
    try {
      if (!signal.aborted && !resEnded) {
        return sendResponseToUwsOpts(res, response$, signal, fetchAPI);
      }
    } catch (err: any) {
      console.error(
        `Unexpected error while handling request: \n${err.stack || err.message || err}`,
      );
    }
  }

  function handleEvent(event: FetchEvent, ...ctx: Partial<TServerContext>[]): void {
    if (!event.respondWith || !event.request) {
      throw new TypeError(`Expected FetchEvent, got ${event}`);
    }
    const filteredCtxParts = ctx.filter(partCtx => partCtx != null);
    const serverContext =
      filteredCtxParts.length > 0
        ? completeAssign({}, event, ...filteredCtxParts)
        : isolateObject(event);
    const response$ = handleRequest(event.request, serverContext);
    event.respondWith(response$);
  }

  function handleRequestWithWaitUntil(request: Request, ...ctx: Partial<TServerContext>[]) {
    const filteredCtxParts: any[] = ctx.filter(partCtx => partCtx != null);
    const serverContext =
      filteredCtxParts.length > 1
        ? completeAssign({}, ...filteredCtxParts)
        : isolateObject(
            filteredCtxParts[0],
            filteredCtxParts[0] == null || filteredCtxParts[0].waitUntil == null
              ? waitUntil
              : undefined,
          );
    return handleRequest(request, serverContext);
  }

  const fetchFn: ServerAdapterObject<TServerContext>['fetch'] = (
    input,
    ...maybeCtx: Partial<TServerContext>[]
  ) => {
    if (typeof input === 'string' || 'href' in input) {
      const [initOrCtx, ...restOfCtx] = maybeCtx;
      if (isRequestInit(initOrCtx)) {
        const request = new fetchAPI.Request(input, initOrCtx);
        const res$ = handleRequestWithWaitUntil(request, ...restOfCtx);
        return handleAbortSignalAndPromiseResponse(res$, (initOrCtx as RequestInit)?.signal);
      }
      const request = new fetchAPI.Request(input);
      return handleRequestWithWaitUntil(request, ...maybeCtx);
    }
    const res$ = handleRequestWithWaitUntil(input, ...maybeCtx);
    return handleAbortSignalAndPromiseResponse(res$, (input as any)._signal);
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
    handleRequest: handleRequestWithWaitUntil,
    fetch: fetchFn,
    handleNodeRequest,
    handleNodeRequestAndResponse,
    requestListener,
    handleEvent,
    handleUWS,
    handle: genericRequestHandler as ServerAdapterObject<TServerContext>['handle'],
    disposableStack,
    [DisposableSymbols.asyncDispose]() {
      if (!disposableStack.disposed) {
        return disposableStack.disposeAsync();
      }
      return fakePromise(undefined);
    },
    dispose() {
      if (!disposableStack.disposed) {
        return disposableStack.disposeAsync();
      }
      return fakePromise(undefined);
    },
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
  return serverAdapter as ServerAdapter<TServerContext, TBaseObject>;
}

export { createServerAdapter };
