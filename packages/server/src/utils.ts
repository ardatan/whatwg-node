import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Http2ServerRequest, Http2ServerResponse } from 'node:http2';
import type { Socket } from 'node:net';
import type { Readable } from 'node:stream';
import {
  createDeferredPromise,
  fakePromise,
  handleMaybePromise,
  isPromise,
  MaybePromise,
} from '@whatwg-node/promise-helpers';
import type { FetchAPI, FetchEvent, WaitUntilFn } from './types.js';

export { isPromise, createDeferredPromise };

export function isAsyncIterable(body: any): body is AsyncIterable<any> {
  return (
    body != null && typeof body === 'object' && typeof body[Symbol.asyncIterator] === 'function'
  );
}

export interface NodeRequest {
  protocol?: string | undefined;
  hostname?: string | undefined;
  body?: any | undefined;
  url?: string | undefined;
  originalUrl?: string | undefined;
  method?: string | undefined;
  headers?: any | undefined;
  req?: IncomingMessage | Http2ServerRequest | undefined;
  raw?: IncomingMessage | Http2ServerRequest | undefined;
  socket?: Socket | undefined;
  query?: any | undefined;
  once?(event: string, listener: (...args: any[]) => void): void;
  aborted?: boolean | undefined;
}

export type NodeResponse = ServerResponse | Http2ServerResponse;

function getPort(nodeRequest: NodeRequest) {
  if (nodeRequest.socket?.localPort) {
    return nodeRequest.socket?.localPort;
  }
  const hostInHeader = nodeRequest.headers?.[':authority'] || nodeRequest.headers?.host;
  const portInHeader = hostInHeader?.split(':')?.[1];
  if (portInHeader) {
    return portInHeader;
  }
  return 80;
}

function getHostnameWithPort(nodeRequest: NodeRequest) {
  if (nodeRequest.headers?.[':authority']) {
    return nodeRequest.headers?.[':authority'];
  }
  if (nodeRequest.headers?.host) {
    return nodeRequest.headers?.host;
  }
  const port = getPort(nodeRequest);
  if (nodeRequest.hostname) {
    return nodeRequest.hostname + ':' + port;
  }
  const localIp = nodeRequest.socket?.localAddress;
  if (localIp && !localIp?.includes('::') && !localIp?.includes('ffff')) {
    return `${localIp}:${port}`;
  }
  return 'localhost';
}

function buildFullUrl(nodeRequest: NodeRequest) {
  const hostnameWithPort = getHostnameWithPort(nodeRequest);
  const protocol =
    nodeRequest.protocol || ((nodeRequest.socket as any)?.encrypted ? 'https' : 'http');
  const endpoint = nodeRequest.originalUrl || nodeRequest.url || '/graphql';

  return `${protocol}://${hostnameWithPort}${endpoint}`;
}

function isRequestBody(body: any): body is BodyInit {
  const stringTag = body[Symbol.toStringTag];
  if (
    typeof body === 'string' ||
    stringTag === 'Uint8Array' ||
    stringTag === 'Blob' ||
    stringTag === 'FormData' ||
    stringTag === 'URLSearchParams' ||
    isAsyncIterable(body)
  ) {
    return true;
  }
  return false;
}

export function normalizeNodeRequest(
  nodeRequest: NodeRequest,
  fetchAPI: FetchAPI,
  nodeResponse?: NodeResponse,
): Request {
  const rawRequest = nodeRequest.raw || nodeRequest.req || nodeRequest;
  let fullUrl = buildFullUrl(rawRequest);
  if (nodeRequest.query) {
    const url = new fetchAPI.URL(fullUrl);
    for (const key in nodeRequest.query) {
      url.searchParams.set(key, nodeRequest.query[key]);
    }
    fullUrl = url.toString();
  }

  let normalizedHeaders: Record<string, string> = nodeRequest.headers;
  if (nodeRequest.headers?.[':method']) {
    normalizedHeaders = {};
    for (const key in nodeRequest.headers) {
      if (!key.startsWith(':')) {
        normalizedHeaders[key] = nodeRequest.headers[key];
      }
    }
  }
  const controller = new AbortController();
  if (nodeResponse?.once) {
    const closeEventListener: EventListener = () => {
      if (!controller.signal.aborted) {
        Object.defineProperty(rawRequest, 'aborted', { value: true });
        controller.abort(nodeResponse.errored ?? undefined);
      }
    };

    nodeResponse.once('error', closeEventListener);
    nodeResponse.once('close', closeEventListener);

    nodeResponse.once('finish', () => {
      nodeResponse.removeListener('close', closeEventListener);
    });
  }

  if (nodeRequest.method === 'GET' || nodeRequest.method === 'HEAD') {
    return new fetchAPI.Request(fullUrl, {
      method: nodeRequest.method,
      headers: normalizedHeaders,
      signal: controller.signal,
    });
  }

  /**
   * Some Node server frameworks like Serverless Express sends a dummy object with body but as a Buffer not string
   * so we do those checks to see is there something we can use directly as BodyInit
   * because the presence of body means the request stream is already consumed and,
   * rawRequest cannot be used as BodyInit/ReadableStream by Fetch API in this case.
   */
  const maybeParsedBody = nodeRequest.body;
  if (maybeParsedBody != null && Object.keys(maybeParsedBody).length > 0) {
    if (isRequestBody(maybeParsedBody)) {
      return new fetchAPI.Request(fullUrl, {
        method: nodeRequest.method || 'GET',
        headers: normalizedHeaders,
        body: maybeParsedBody,
        signal: controller.signal,
      });
    }
    const request = new fetchAPI.Request(fullUrl, {
      method: nodeRequest.method || 'GET',
      headers: normalizedHeaders,
      signal: controller.signal,
    });
    if (!request.headers.get('content-type')?.includes('json')) {
      request.headers.set('content-type', 'application/json; charset=utf-8');
    }
    return new Proxy(request, {
      get: (target, prop: keyof Request, receiver) => {
        switch (prop) {
          case 'json':
            return () => fakePromise(maybeParsedBody);
          case 'text':
            return () => fakePromise(JSON.stringify(maybeParsedBody));
          default:
            if (globalThis.Bun) {
              // workaround for https://github.com/oven-sh/bun/issues/12368
              // Proxy.get doesn't seem to get `receiver` correctly
              return Reflect.get(target, prop);
            }
            return Reflect.get(target, prop, receiver);
        }
      },
    });
  }

  // perf: instead of spreading the object, we can just pass it as is and it performs better
  return new fetchAPI.Request(fullUrl, {
    method: nodeRequest.method,
    headers: normalizedHeaders,
    signal: controller.signal,
    // @ts-expect-error - AsyncIterable is supported as body
    body: rawRequest,
    duplex: 'half',
  });
}

export function isReadable(stream: any): stream is Readable {
  return stream.read != null;
}

export function isNodeRequest(request: any): request is NodeRequest {
  return isReadable(request);
}

export function isServerResponse(stream: any): stream is NodeResponse {
  // Check all used functions are defined
  return (
    stream != null &&
    stream.setHeader != null &&
    stream.end != null &&
    stream.once != null &&
    stream.write != null
  );
}

export function isReadableStream(stream: any): stream is ReadableStream {
  return stream != null && stream.getReader != null;
}

export function isFetchEvent(event: any): event is FetchEvent {
  return event != null && event.request != null && event.respondWith != null;
}

function configureSocket(rawRequest: NodeRequest) {
  rawRequest?.socket?.setTimeout?.(0);
  rawRequest?.socket?.setNoDelay?.(true);
  rawRequest?.socket?.setKeepAlive?.(true);
}

function endResponse(serverResponse: NodeResponse) {
  // @ts-expect-error Avoid arguments adaptor trampoline https://v8.dev/blog/adaptor-frame
  serverResponse.end(null, null, null);
}

function sendAsyncIterable(serverResponse: NodeResponse, asyncIterable: AsyncIterable<Uint8Array>) {
  let closed = false;
  const closeEventListener = () => {
    closed = true;
  };
  serverResponse.once('error', closeEventListener);
  serverResponse.once('close', closeEventListener);

  serverResponse.once('finish', () => {
    serverResponse.removeListener('close', closeEventListener);
    serverResponse.removeListener('error', closeEventListener);
  });
  const iterator = asyncIterable[Symbol.asyncIterator]();
  const pump = (): Promise<void> =>
    iterator.next().then(({ done, value }) => {
      if (closed || done) {
        return;
      }
      return handleMaybePromise(
        () => safeWrite(value, serverResponse),
        () => (closed ? endResponse(serverResponse) : pump()),
      );
    });
  return pump();
}

function safeWrite(chunk: any, serverResponse: NodeResponse) {
  // @ts-expect-error http and http2 writes are actually compatible
  const result = serverResponse.write(chunk);
  if (!result) {
    return new Promise(resolve => serverResponse.once('drain', resolve));
  }
}

export function sendNodeResponse(
  fetchResponse: Response,
  serverResponse: NodeResponse,
  nodeRequest: NodeRequest,
) {
  if (serverResponse.closed || serverResponse.destroyed || serverResponse.writableEnded) {
    return;
  }
  if (!fetchResponse) {
    serverResponse.statusCode = 404;
    endResponse(serverResponse);
    return;
  }
  // @ts-expect-error - headersInit is a private property
  if (fetchResponse.headers?.headersInit && !fetchResponse.headers?._map) {
    // @ts-expect-error - headersInit is a private property
    serverResponse.writeHead(fetchResponse.status, fetchResponse.headers.headersInit);
  } else {
    serverResponse.statusCode = fetchResponse.status;
    serverResponse.statusMessage = fetchResponse.statusText;

    let setCookiesSet = false;
    fetchResponse.headers.forEach((value, key) => {
      if (key === 'set-cookie') {
        if (setCookiesSet) {
          return;
        }
        setCookiesSet = true;
        const setCookies = fetchResponse.headers.getSetCookie?.();
        if (setCookies) {
          serverResponse.setHeader('set-cookie', setCookies);
          return;
        }
      }
      serverResponse.setHeader(key, value);
    });
  }

  // @ts-expect-error - Handle the case where the response is a string
  if (fetchResponse['bodyType'] === 'String') {
    return handleMaybePromise(
      // @ts-expect-error - bodyInit is a private property
      () => safeWrite(fetchResponse.bodyInit, serverResponse),
      () => endResponse(serverResponse),
    );
  }

  // Optimizations for node-fetch
  const bufOfRes: Buffer =
    // @ts-expect-error - _buffer is a private property
    fetchResponse._buffer;
  if (bufOfRes) {
    return handleMaybePromise(
      () => safeWrite(bufOfRes, serverResponse),
      () => endResponse(serverResponse),
    );
  }

  // Other fetch implementations
  const fetchBody = fetchResponse.body;
  if (fetchBody == null) {
    endResponse(serverResponse);
    return;
  }

  if (
    // @ts-expect-error - Uint8Array is a valid body type
    fetchBody[Symbol.toStringTag] === 'Uint8Array'
  ) {
    return handleMaybePromise(
      () => safeWrite(fetchBody, serverResponse),
      () => endResponse(serverResponse),
    );
  }

  configureSocket(nodeRequest);

  if (isReadable(fetchBody)) {
    serverResponse.once('close', () => {
      fetchBody.destroy();
    });
    fetchBody.pipe(serverResponse, {
      end: true,
    });
    return;
  }

  if (isReadableStream(fetchBody)) {
    return sendReadableStream(nodeRequest, serverResponse, fetchBody);
  }

  if (isAsyncIterable(fetchBody)) {
    return sendAsyncIterable(serverResponse, fetchBody);
  }
}

function sendReadableStream(
  nodeRequest: NodeRequest,
  serverResponse: NodeResponse,
  readableStream: ReadableStream<Uint8Array>,
) {
  const reader = readableStream.getReader();
  nodeRequest?.once?.('error', err => {
    reader.cancel(err);
  });
  function pump(): Promise<void> {
    return reader
      .read()
      .then(({ done, value }) =>
        done
          ? endResponse(serverResponse)
          : handleMaybePromise(() => safeWrite(value, serverResponse), pump),
      );
  }
  return pump();
}

export function isRequestInit(val: unknown): val is RequestInit {
  return (
    val != null &&
    typeof val === 'object' &&
    ('body' in val ||
      'cache' in val ||
      'credentials' in val ||
      'headers' in val ||
      'integrity' in val ||
      'keepalive' in val ||
      'method' in val ||
      'mode' in val ||
      'redirect' in val ||
      'referrer' in val ||
      'referrerPolicy' in val ||
      'signal' in val ||
      'window' in val)
  );
}

// from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#copying_accessors
export function completeAssign(...args: any[]) {
  const [target, ...sources] = args.filter(arg => arg != null && typeof arg === 'object');
  sources.forEach(source => {
    // modified Object.keys to Object.getOwnPropertyNames
    // because Object.keys only returns enumerable properties
    const descriptors: any = Object.getOwnPropertyNames(source).reduce((descriptors: any, key) => {
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (descriptor) {
        descriptors[key] = Object.getOwnPropertyDescriptor(source, key);
      }
      return descriptors;
    }, {});

    // By default, Object.assign copies enumerable Symbols, too
    Object.getOwnPropertySymbols(source).forEach(sym => {
      const descriptor = Object.getOwnPropertyDescriptor(source, sym);
      if (descriptor?.enumerable) {
        descriptors[sym] = descriptor;
      }
    });

    Object.defineProperties(target, descriptors);
  });
  return target;
}

export { iterateAsyncVoid } from '@whatwg-node/promise-helpers';

export function handleErrorFromRequestHandler(error: any, ResponseCtor: typeof Response) {
  return new ResponseCtor(error.stack || error.message || error.toString(), {
    status: error.status || 500,
  });
}

export function isolateObject<TIsolatedObject extends object>(
  originalCtx: TIsolatedObject,
  waitUntilFn?: WaitUntilFn,
): TIsolatedObject {
  if (originalCtx == null) {
    if (waitUntilFn == null) {
      return {} as TIsolatedObject;
    }
    return {
      waitUntil: waitUntilFn,
    } as TIsolatedObject;
  }
  return completeAssign(
    Object.create(originalCtx),
    {
      waitUntil: waitUntilFn,
    },
    originalCtx,
  );
}

export function handleAbortSignalAndPromiseResponse(
  response$: MaybePromise<Response>,
  abortSignal: AbortSignal,
) {
  if (abortSignal?.aborted) {
    throw abortSignal.reason;
  }
  if (isPromise(response$) && abortSignal) {
    const deferred$ = createDeferredPromise<Response>();
    function abortSignalFetchErrorHandler() {
      deferred$.reject(abortSignal.reason);
    }
    abortSignal.addEventListener('abort', abortSignalFetchErrorHandler, { once: true });
    response$
      .then(function fetchSuccessHandler(res) {
        deferred$.resolve(res);
      })
      .catch(function fetchErrorHandler(err) {
        deferred$.reject(err);
      })
      .finally(() => {
        abortSignal.removeEventListener('abort', abortSignalFetchErrorHandler);
      });
    return deferred$.promise;
  }
  return response$;
}

export const decompressedResponseMap = new WeakMap<Response, Response>();

const supportedEncodingsByFetchAPI = new WeakMap<FetchAPI, CompressionFormat[]>();

export function getSupportedEncodings(fetchAPI: FetchAPI) {
  let supportedEncodings = supportedEncodingsByFetchAPI.get(fetchAPI);
  if (!supportedEncodings) {
    const possibleEncodings = ['deflate', 'gzip', 'deflate-raw', 'br'] as CompressionFormat[];
    if ((fetchAPI.DecompressionStream as any)?.['supportedFormats']) {
      supportedEncodings = (fetchAPI.DecompressionStream as any)[
        'supportedFormats'
      ] as CompressionFormat[];
    } else {
      supportedEncodings = possibleEncodings.filter(encoding => {
        // deflate-raw is not supported in Node.js >v20
        if (
          globalThis.process?.version?.startsWith('v2') &&
          fetchAPI.DecompressionStream === globalThis.DecompressionStream &&
          encoding === 'deflate-raw'
        ) {
          return false;
        }
        try {
          // eslint-disable-next-line no-new
          new fetchAPI.DecompressionStream(encoding);
          return true;
        } catch {
          return false;
        }
      });
    }

    supportedEncodingsByFetchAPI.set(fetchAPI, supportedEncodings);
  }
  return supportedEncodings;
}

export function handleResponseDecompression(response: Response, fetchAPI: FetchAPI) {
  const contentEncodingHeader = response?.headers.get('content-encoding');
  if (!contentEncodingHeader || contentEncodingHeader === 'none') {
    return response;
  }
  if (!response?.body) {
    return response;
  }
  let decompressedResponse = decompressedResponseMap.get(response);
  if (!decompressedResponse || decompressedResponse.bodyUsed) {
    let decompressedBody = response.body;
    const contentEncodings = contentEncodingHeader.split(',');
    if (
      !contentEncodings.every(encoding =>
        getSupportedEncodings(fetchAPI).includes(encoding as CompressionFormat),
      )
    ) {
      return new fetchAPI.Response(`Unsupported 'Content-Encoding': ${contentEncodingHeader}`, {
        status: 415,
        statusText: 'Unsupported Media Type',
      });
    }
    for (const contentEncoding of contentEncodings) {
      decompressedBody = decompressedBody.pipeThrough(
        new fetchAPI.DecompressionStream(contentEncoding as CompressionFormat),
      );
    }
    decompressedResponse = new fetchAPI.Response(decompressedBody, response);
    decompressedResponseMap.set(response, decompressedResponse);
  }
  return decompressedResponse;
}

const terminateEvents = ['SIGINT', 'exit', 'SIGTERM'] as const;
const disposableStacks = new Set<AsyncDisposableStack>();

let eventListenerRegistered = false;

function ensureEventListenerForDisposableStacks() {
  if (eventListenerRegistered) {
    return;
  }
  eventListenerRegistered = true;
  for (const event of terminateEvents) {
    globalThis.process.once(event, function terminateHandler() {
      return Promise.allSettled(
        [...disposableStacks].map(stack => !stack.disposed && stack.disposeAsync()),
      );
    });
  }
}

export function ensureDisposableStackRegisteredForTerminateEvents(
  disposableStack: AsyncDisposableStack,
) {
  if (globalThis.process) {
    ensureEventListenerForDisposableStacks();
    if (!disposableStacks.has(disposableStack)) {
      disposableStacks.add(disposableStack);
      disposableStack.defer(() => {
        disposableStacks.delete(disposableStack);
      });
    }
  }
}
