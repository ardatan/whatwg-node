import { chain, getInstrumented } from '@envelop/instrumentation';
import { AsyncDisposableStack, DisposableSymbols } from '@whatwg-node/disposablestack';
import * as DefaultFetchAPI from '@whatwg-node/fetch';
import { handleMaybePromise, MaybePromise, unfakePromise } from '@whatwg-node/promise-helpers';
import {
  Instrumentation,
  OnRequestHook,
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
  CustomAbortControllerSignal,
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
  NodeResponse,
  normalizeNodeRequest,
  sendNodeResponse,
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
  /**
   * Node.js only!
   *
   * If true, the server adapter will dispose itself when the process is terminated.
   * If false, you have to dispose the server adapter by using the `dispose` method,
   * or [Explicit Resource Management](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html)
   */
  disposeOnProcessTerminate?: boolean;

  // Internal flags for testing
  __useCustomAbortCtrl?: boolean;
  __useSingleWriteHead?: boolean;
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
  const useSingleWriteHead =
    options?.__useSingleWriteHead == null ? true : options.__useSingleWriteHead;
  const useCustomAbortCtrl =
    options?.__useCustomAbortCtrl == null ? true : options.__useCustomAbortCtrl;
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
  let instrumentation: Instrumentation | undefined;
  const waitUntilPromises = new Set<PromiseLike<unknown>>();
  let _disposableStack: AsyncDisposableStack | undefined;
  function ensureDisposableStack() {
    if (!_disposableStack) {
      _disposableStack = new AsyncDisposableStack();
      if (options?.disposeOnProcessTerminate) {
        ensureDisposableStackRegisteredForTerminateEvents(_disposableStack);
      }
      _disposableStack.defer(() => {
        if (waitUntilPromises.size > 0) {
          return Promise.allSettled(waitUntilPromises).then(
            () => {
              waitUntilPromises.clear();
            },
            () => {
              waitUntilPromises.clear();
            },
          );
        }
      });
    }
    return _disposableStack;
  }

  function waitUntil(maybePromise: MaybePromise<void>) {
    // Ensure that the disposable stack is created
    if (isPromise(maybePromise)) {
      ensureDisposableStack();
      waitUntilPromises.add(maybePromise);
      maybePromise.then(
        () => {
          waitUntilPromises.delete(maybePromise);
        },
        err => {
          console.error(`Unexpected error while waiting: ${err.message || err}`);
          waitUntilPromises.delete(maybePromise);
        },
      );
    }
  }

  if (options?.plugins != null) {
    for (const plugin of options.plugins) {
      if (plugin.instrumentation) {
        instrumentation = instrumentation
          ? chain(instrumentation, plugin.instrumentation)
          : plugin.instrumentation;
      }
      if (plugin.onRequest) {
        onRequestHooks.push(plugin.onRequest);
      }
      if (plugin.onResponse) {
        onResponseHooks.push(plugin.onResponse);
      }
      const disposeFn = plugin[DisposableSymbols.dispose];
      if (disposeFn) {
        ensureDisposableStack().defer(disposeFn);
      }
      const asyncDisposeFn = plugin[DisposableSymbols.asyncDispose];
      if (asyncDisposeFn) {
        ensureDisposableStack().defer(asyncDisposeFn);
      }
      if (plugin.onDispose) {
        ensureDisposableStack().defer(plugin.onDispose);
      }
    }
  }

  let handleRequest: ServerAdapterRequestHandler<TServerContext & ServerAdapterInitialContext> =
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
          function handleResponse(response: Response) {
            if (onResponseHooks.length === 0) {
              return response;
            }
            return handleMaybePromise(
              () =>
                iterateAsyncVoid(onResponseHooks, onResponseHook =>
                  onResponseHook({
                    request,
                    response,
                    serverContext,
                    setResponse(newResponse) {
                      response = newResponse;
                    },
                    fetchAPI,
                  }),
                ),
              () => response,
            );
          }
          function handleEarlyResponse() {
            if (!response) {
              return handleMaybePromise(
                () => requestHandler(request, serverContext),
                handleResponse,
              );
            }
            return handleResponse(response);
          }
          return handleMaybePromise(
            () =>
              iterateAsyncVoid(onRequestHooks, (onRequestHook, stopEarly) =>
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
              ),
            handleEarlyResponse,
          );
        }
      : givenHandleRequest;

  if (instrumentation?.request) {
    const originalRequestHandler = handleRequest;
    handleRequest = (request, initialContext) => {
      return getInstrumented({ request }).asyncFn(instrumentation.request, originalRequestHandler)(
        request,
        initialContext,
      );
    };
  }

  // TODO: Remove this on the next major version
  function handleNodeRequest(nodeRequest: NodeRequest, ...ctx: Partial<TServerContext>[]) {
    const serverContext = ctx.length > 1 ? completeAssign(...ctx) : ctx[0] || {};
    // Ensure `waitUntil` is available in the server context
    if (!serverContext.waitUntil) {
      serverContext.waitUntil = waitUntil;
    }
    const request = normalizeNodeRequest(nodeRequest, fetchAPI, undefined, useCustomAbortCtrl);
    return handleRequest(request, serverContext);
  }

  function handleNodeRequestAndResponse(
    nodeRequest: NodeRequest,
    nodeResponseOrContainer: NodeResponse | { raw: NodeResponse },
    ...ctx: Partial<TServerContext>[]
  ) {
    const nodeResponse: NodeResponse =
      (nodeResponseOrContainer as any).raw || nodeResponseOrContainer;
    const serverContext = ctx.length > 1 ? completeAssign(...ctx) : ctx[0] || {};
    // Ensure `waitUntil` is available in the server context
    if (!serverContext.waitUntil) {
      serverContext.waitUntil = waitUntil;
    }
    const request = normalizeNodeRequest(nodeRequest, fetchAPI, nodeResponse, useCustomAbortCtrl);
    return handleRequest(request, serverContext);
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
    return unfakePromise(
      fakePromise()
        .then(() =>
          handleNodeRequestAndResponse(
            nodeRequest,
            nodeResponse,
            defaultServerContext as any,
            ...ctx,
          ),
        )
        .catch(err => handleErrorFromRequestHandler(err, fetchAPI.Response))
        .then(response => sendNodeResponse(response, nodeResponse, nodeRequest, useSingleWriteHead))
        .catch(err =>
          console.error(`Unexpected error while handling request: ${err.message || err}`),
        ),
    );
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

    const controller =
      fetchAPI.Request === globalThis.Request
        ? new AbortController()
        : new CustomAbortControllerSignal();
    const originalResEnd = res.end.bind(res);
    let resEnded = false;
    res.end = function (data: any) {
      resEnded = true;
      return originalResEnd(data);
    };
    const originalOnAborted = res.onAborted.bind(res);
    originalOnAborted(function () {
      controller.abort();
    });
    res.onAborted = function (cb: () => void) {
      controller.signal.addEventListener('abort', cb, { once: true });
    };
    const request = getRequestFromUWSRequest({
      req,
      res,
      fetchAPI,
      controller,
    });
    return handleMaybePromise(
      () =>
        handleMaybePromise(
          () => handleRequest(request, serverContext),
          response => response,
          err => handleErrorFromRequestHandler(err, fetchAPI.Response),
        ),
      response => {
        if (!controller.signal.aborted && !resEnded) {
          return handleMaybePromise(
            () => sendResponseToUwsOpts(res, response, controller, fetchAPI),
            r => r,
            err => {
              console.error(`Unexpected error while handling request: ${err.message || err}`);
            },
          );
        }
      },
    );
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
        const signal = (initOrCtx as RequestInit).signal;
        if (signal) {
          return handleAbortSignalAndPromiseResponse(res$, signal);
        }
        return res$;
      }
      const request = new fetchAPI.Request(input);
      return handleRequestWithWaitUntil(request, ...maybeCtx);
    }
    const res$ = handleRequestWithWaitUntil(input, ...maybeCtx);
    return handleAbortSignalAndPromiseResponse(res$, input.signal);
  };

  const genericRequestHandler = (
    input:
      | Request
      | FetchEvent
      | NodeRequest
      | ({ request: Request } & Partial<TServerContext>)
      | UWSResponse,
    ...maybeCtx: Partial<TServerContext>[]
  ): MaybePromise<Response> | MaybePromise<void> => {
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
    get disposableStack() {
      return ensureDisposableStack();
    },
    [DisposableSymbols.asyncDispose]() {
      if (_disposableStack && !_disposableStack.disposed) {
        return _disposableStack.disposeAsync();
      }
      return fakePromise();
    },
    dispose() {
      if (_disposableStack && !_disposableStack.disposed) {
        return _disposableStack.disposeAsync();
      }
      return fakePromise();
    },
    waitUntil,
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
      // Somehow Deno and Node 24 don't like bound dispose functions
      if (globalThis.Deno || prop === Symbol.asyncDispose || prop === Symbol.dispose) {
        const adapterProp = Reflect.get(adapterObj, prop, adapterObj);
        if (adapterProp) {
          return adapterProp;
        }
      }
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
