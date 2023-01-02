import { IncomingMessage, ServerResponse } from 'node:http';
import type { Http2ServerRequest, Http2ServerResponse } from 'node:http2';
import type { Socket } from 'node:net';
import type { Readable } from 'node:stream';
import { FetchEvent } from './types';

export function isAsyncIterable(body: any): body is AsyncIterable<any> {
  return body != null && typeof body === 'object' && typeof body[Symbol.asyncIterator] === 'function';
}

export interface NodeRequest {
  protocol?: string;
  hostname?: string;
  body?: any;
  url?: string;
  originalUrl?: string;
  method?: string;
  headers?: any;
  req?: IncomingMessage | Http2ServerRequest;
  raw?: IncomingMessage | Http2ServerRequest;
  socket?: Socket;
  query?: any;
}

export type NodeResponse = ServerResponse | Http2ServerResponse;

function getPort(nodeRequest: NodeRequest) {
  if (nodeRequest.socket?.localPort) {
    return nodeRequest.socket?.localPort;
  }
  const portInHeader = nodeRequest.headers?.host?.split(':')?.[1];
  if (portInHeader) {
    return portInHeader;
  }
  return 80;
}

function getHostnameWithPort(nodeRequest: NodeRequest) {
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
  const protocol = nodeRequest.protocol || 'http';
  const endpoint = nodeRequest.originalUrl || nodeRequest.url || '/graphql';

  return `${protocol}://${hostnameWithPort}${endpoint}`;
}

function configureSocket(rawRequest: NodeRequest) {
  rawRequest?.socket?.setTimeout?.(0);
  rawRequest?.socket?.setNoDelay?.(true);
  rawRequest?.socket?.setKeepAlive?.(true);
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

export function normalizeNodeRequest(nodeRequest: NodeRequest, RequestCtor: typeof Request): Request {
  const rawRequest = nodeRequest.raw || nodeRequest.req || nodeRequest;
  configureSocket(rawRequest);
  let fullUrl = buildFullUrl(rawRequest);
  if (nodeRequest.query) {
    const urlObj = new URL(fullUrl);
    for (const queryName in nodeRequest.query) {
      const queryValue = nodeRequest.query[queryName];
      urlObj.searchParams.set(queryName, queryValue);
    }
    fullUrl = urlObj.toString();
  }
  const baseRequestInit: RequestInit = {
    method: nodeRequest.method,
    headers: nodeRequest.headers,
  };

  if (nodeRequest.method === 'GET' || nodeRequest.method === 'HEAD') {
    return new RequestCtor(fullUrl, baseRequestInit);
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
      return new RequestCtor(fullUrl, {
        ...baseRequestInit,
        body: maybeParsedBody,
      });
    }
    const request = new RequestCtor(fullUrl, {
      ...baseRequestInit,
    });
    if (!request.headers.get('content-type')?.includes('json')) {
      request.headers.set('content-type', 'application/json');
    }
    return new Proxy(request, {
      get: (target, prop: keyof Request, receiver) => {
        switch (prop) {
          case 'json':
            return async () => maybeParsedBody;
          case 'text':
            return async () => JSON.stringify(maybeParsedBody);
          default:
            return Reflect.get(target, prop, receiver);
        }
      },
    });
  }

  return new RequestCtor(fullUrl, {
    headers: nodeRequest.headers,
    method: nodeRequest.method,
    body: rawRequest as any,
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
    stream != null && stream.setHeader != null && stream.end != null && stream.once != null && stream.write != null
  );
}

export function isReadableStream(stream: any): stream is ReadableStream {
  return stream != null && stream.getReader != null;
}

export function isFetchEvent(event: any): event is FetchEvent {
  return event != null && event.request != null && event.respondWith != null;
}

export async function sendNodeResponse({ headers, status, statusText, body }: Response, serverResponse: NodeResponse) {
  headers.forEach((value, name) => {
    serverResponse.setHeader(name, value);
  });
  serverResponse.statusCode = status;
  serverResponse.statusMessage = statusText;
  // eslint-disable-next-line no-async-promise-executor
  return new Promise<void>(async resolve => {
    if (body == null) {
      serverResponse.end('', resolve);
    } else if (body[Symbol.toStringTag] === 'Uint8Array') {
      serverResponse
        // @ts-expect-error http and http2 writes are actually compatible
        .write(body);
      serverResponse.end('', resolve);
    } else if (isReadable(body)) {
      serverResponse.once('close', () => {
        body.destroy();
        resolve();
      });
      body.pipe(serverResponse);
    } else if (isAsyncIterable(body)) {
      for await (const chunk of body as AsyncIterable<Uint8Array>) {
        if (
          !serverResponse
            // @ts-expect-error http and http2 writes are actually compatible
            .write(chunk)
        ) {
          break;
        }
      }
      serverResponse.end('', resolve);
    }
  });
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
