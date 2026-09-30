import { request as httpRequest, STATUS_CODES } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { PassThrough, Readable } from 'node:stream';
import zlib from 'node:zlib';
import { handleMaybePromise } from '@whatwg-node/promise-helpers';
import type { BodyPonyfillInit } from './Body.js';
import { getHttpsCheckServerIdentity } from './checkServerIdentity.js';
import { PonyfillHeaders } from './Headers.js';
import { PonyfillRequest, RequestPonyfillInit } from './Request.js';
import { PonyfillResponse } from './Response.js';
import { PonyfillURL } from './URL.js';
import {
  DEFAULT_ACCEPT_ENCODING,
  endStream,
  getHeadersObj,
  isNodeReadable,
  pipeThrough,
  safeWrite,
  shouldRedirect,
} from './utils.js';

// https://fetch.spec.whatwg.org/#http-redirect-fetch step 7
const MAX_REDIRECTS = 20;
const redirectCounts = new WeakMap<PonyfillRequest, number>();

// https://fetch.spec.whatwg.org/#cors-non-wildcard-request-header-name
// Cookie, Cookie2, and Host are forbidden request headers. Undici removes them
// on a cross-origin redirect because this client has no cookie jar and would
// otherwise forward caller-supplied credentials.
const CROSS_ORIGIN_REMOVED_HEADERS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'cookie2',
  'host',
] as const;

// https://fetch.spec.whatwg.org/#request-body-header-name
// Content-Length is included for the same reason as undici: this Headers
// implementation does not treat it as forbidden.
const REQUEST_BODY_HEADERS = [
  'content-encoding',
  'content-language',
  'content-location',
  'content-type',
  'content-length',
] as const;

function shouldRewriteRedirectMethod(statusCode: number | undefined, method: string): boolean {
  return (
    ((statusCode === 301 || statusCode === 302) && method === 'POST') ||
    (statusCode === 303 && method !== 'GET' && method !== 'HEAD')
  );
}

function headersForRedirect(source: Headers, omit: ReadonlySet<string>): PonyfillHeaders {
  // Rebuild instead of deleting on a copy. Header names from a plain object
  // stay in their original case until the map is materialized, so
  // `delete('authorization')` would miss `Authorization`.
  const headers = new PonyfillHeaders();
  source.forEach((value, key) => {
    if (!omit.has(key.toLowerCase())) {
      headers.append(key, value);
    }
  });
  return headers;
}

const REPLAYABLE_BODY_TYPES = new Set(['String', 'Blob', 'FormData']);

function replayableRedirectBody(fetchRequest: PonyfillRequest): {
  body: BodyPonyfillInit | null;
  dropContentType: boolean;
} {
  const bodyInit = fetchRequest['bodyInit'] as BodyPonyfillInit | null | undefined;
  const bodyType = fetchRequest['bodyType'] as string | undefined;
  const buffer = fetchRequest['_buffer'] as Buffer | undefined;
  if (bodyInit == null && buffer == null) {
    return { body: null, dropContentType: false };
  }
  // A buffer, string, blob, or FormData can be sent again. A stream's source
  // is null after the first hop, which the Fetch standard treats as a network error.
  if (buffer != null) {
    return { body: buffer as BodyPonyfillInit, dropContentType: false };
  }
  if (bodyType != null && REPLAYABLE_BODY_TYPES.has(bodyType)) {
    return { body: bodyInit ?? null, dropContentType: bodyType === 'FormData' };
  }
  throw new TypeError('Request body cannot be replayed across redirects');
}

function createRedirectRequest<TRequestJSON>(
  fetchRequest: PonyfillRequest<TRequestJSON>,
  redirectedUrl: URL,
  statusCode: number | undefined,
): PonyfillRequest<TRequestJSON> {
  const crossOrigin = redirectedUrl.origin !== fetchRequest.parsedUrl.origin;
  // Node turns URL username/password into an Authorization header. A cors
  // request must not carry those credentials to another origin.
  if (
    crossOrigin &&
    fetchRequest.mode === 'cors' &&
    (redirectedUrl.username !== '' || redirectedUrl.password !== '')
  ) {
    throw new TypeError('URL cannot contain credentials for request mode "cors"');
  }
  const rewriteMethod = shouldRewriteRedirectMethod(statusCode, fetchRequest.method);
  const replayed = rewriteMethod
    ? { body: null, dropContentType: false }
    : replayableRedirectBody(fetchRequest);

  const omit = new Set<string>();
  if (crossOrigin) {
    for (const headerName of CROSS_ORIGIN_REMOVED_HEADERS) {
      omit.add(headerName);
    }
  }
  if (rewriteMethod) {
    for (const headerName of REQUEST_BODY_HEADERS) {
      omit.add(headerName);
    }
  }
  if (replayed.dropContentType) {
    omit.add('content-type');
  }
  const headers = headersForRedirect(fetchRequest.headers, omit);

  const redirectInit: RequestPonyfillInit = {
    method: rewriteMethod ? 'GET' : fetchRequest.method,
    headers,
    body: replayed.body,
    redirect: fetchRequest.redirect,
    credentials: fetchRequest.credentials,
    mode: fetchRequest.mode,
    cache: fetchRequest.cache,
    integrity: fetchRequest.integrity,
    keepalive: fetchRequest.keepalive,
    referrer: fetchRequest.referrer,
    referrerPolicy: fetchRequest.referrerPolicy,
    duplex: fetchRequest.duplex,
    ...(fetchRequest.headersSerializer
      ? { headersSerializer: fetchRequest.headersSerializer }
      : {}),
    ...(fetchRequest.agent != null ? { agent: fetchRequest.agent } : {}),
    ...(fetchRequest._signal ? { signal: fetchRequest._signal } : {}),
  };

  return new PonyfillRequest(redirectedUrl, redirectInit);
}

function getRequestFnForProtocol(url: string) {
  if (url.startsWith('http:')) {
    return httpRequest;
  } else if (url.startsWith('https:')) {
    return httpsRequest;
  }
  throw new TypeError(`Unsupported protocol: ${url.split(':')[0] || url}`);
}

function isHttpsRequest(url: string | URL | undefined): boolean {
  if (!url) {
    return false;
  }
  if (typeof url === 'string') {
    return url.startsWith('https:');
  }
  return url.protocol === 'https:';
}

export function fetchNodeHttp<TResponseJSON = any, TRequestJSON = any>(
  fetchRequest: PonyfillRequest<TRequestJSON>,
): Promise<PonyfillResponse<TResponseJSON>> {
  return new Promise((resolve, reject) => {
    try {
      const requestFn = getRequestFnForProtocol(
        fetchRequest.parsedUrl?.protocol || fetchRequest.url,
      );

      const headersSerializer: typeof getHeadersObj =
        (fetchRequest.headersSerializer as any) || getHeadersObj;
      const nodeHeaders = headersSerializer(fetchRequest.headers);
      nodeHeaders['accept-encoding'] ||= DEFAULT_ACCEPT_ENCODING;
      if (nodeHeaders['user-agent'] == null && nodeHeaders['User-Agent'] == null) {
        nodeHeaders['user-agent'] = 'node';
      }

      let signal: AbortSignal | undefined;

      if (fetchRequest._signal == null) {
        signal = undefined;
      } else if (fetchRequest._signal) {
        signal = fetchRequest._signal;
      }

      let nodeRequest: ReturnType<typeof requestFn>;

      const requestTarget = fetchRequest.parsedUrl || fetchRequest.url;
      const requestOptions: Parameters<typeof httpsRequest>[1] = {
        method: fetchRequest.method,
        headers: nodeHeaders,
        signal,
        agent: fetchRequest.agent,
      };
      // Probe once on first https use; override only if this Node build is affected
      // (https://github.com/nodejs/node/issues/64032).
      const httpsCheckServerIdentity = isHttpsRequest(requestTarget)
        ? getHttpsCheckServerIdentity()
        : undefined;
      if (httpsCheckServerIdentity) {
        requestOptions.checkServerIdentity = httpsCheckServerIdentity;
      }

      // If it is our ponyfilled Request, it should have `parsedUrl` which is a `URL` object
      if (fetchRequest.parsedUrl) {
        nodeRequest = requestFn(fetchRequest.parsedUrl, requestOptions);
      } else {
        nodeRequest = requestFn(fetchRequest.url, requestOptions);
      }

      nodeRequest.once('error', reject);
      nodeRequest.once('response', nodeResponse => {
        let outputStream: PassThrough | undefined;
        const contentEncoding = nodeResponse.headers['content-encoding'];
        switch (contentEncoding) {
          case 'x-gzip':
          case 'gzip':
            outputStream = zlib.createGunzip();
            break;
          case 'x-deflate':
          case 'deflate':
            outputStream = zlib.createInflate();
            break;
          case 'x-deflate-raw':
          case 'deflate-raw':
            outputStream = zlib.createInflateRaw();
            break;
          case 'br':
            outputStream = zlib.createBrotliDecompress();
            break;
          case 'zstd':
            outputStream = zlib.createZstdDecompress();
            break;
        }
        const location = Array.isArray(nodeResponse.headers.location)
          ? nodeResponse.headers.location[0]
          : nodeResponse.headers.location;
        if (location && shouldRedirect(nodeResponse.statusCode)) {
          if (fetchRequest.redirect === 'error') {
            const redirectError = new TypeError('Redirects are not allowed');
            reject(redirectError);
            nodeResponse.resume();
            return;
          }
          if (fetchRequest.redirect === 'follow') {
            const redirectCount = redirectCounts.get(fetchRequest) ?? 0;
            if (redirectCount >= MAX_REDIRECTS) {
              // Deno rejects with this message. Bun uses TooManyRedirects.
              const redirectError = new TypeError(
                `Fetch failed: Maximum number of redirects (${MAX_REDIRECTS}) reached`,
              );
              (redirectError as TypeError & { code: string }).code = 'TooManyRedirects';
              reject(redirectError);
              nodeResponse.resume();
              return;
            }
            let redirectedUrl: URL;
            try {
              redirectedUrl = new PonyfillURL(location, fetchRequest.parsedUrl || fetchRequest.url);
            } catch (error) {
              reject(error);
              nodeResponse.resume();
              return;
            }
            let redirectRequest: PonyfillRequest<TRequestJSON>;
            try {
              redirectRequest = createRedirectRequest(
                fetchRequest,
                redirectedUrl,
                nodeResponse.statusCode,
              );
            } catch (error) {
              reject(error);
              nodeResponse.resume();
              return;
            }
            redirectCounts.set(redirectRequest, redirectCount + 1);
            const redirectResponse$ = fetchNodeHttp(redirectRequest);
            resolve(
              redirectResponse$.then(redirectResponse => {
                redirectResponse.redirected = true;
                return redirectResponse;
              }),
            );
            nodeResponse.resume();
            return;
          }
        }

        outputStream ||= new PassThrough();

        pipeThrough({
          src: nodeResponse,
          dest: outputStream,
          signal,
          onError: e => {
            if (!nodeResponse.destroyed) {
              nodeResponse.destroy(e);
            }
            if (!outputStream.destroyed) {
              outputStream.destroy(e);
            }
            reject(e);
          },
        });

        const statusCode = nodeResponse.statusCode || 200;
        let statusText = nodeResponse.statusMessage || STATUS_CODES[statusCode];
        if (statusText == null) {
          statusText = '';
        }
        const ponyfillResponse = new PonyfillResponse(outputStream || nodeResponse, {
          status: statusCode,
          statusText,
          headers: nodeResponse.headers as Record<string, string>,
          url: fetchRequest.url,
          signal,
        });
        resolve(ponyfillResponse);
      });

      if (fetchRequest['_buffer'] != null) {
        handleMaybePromise(
          () => safeWrite(fetchRequest['_buffer'], nodeRequest),
          () => endStream(nodeRequest),
          reject,
        );
      } else if (fetchRequest['bodyType'] === 'String') {
        handleMaybePromise(
          () => safeWrite(fetchRequest['bodyInit'] as string, nodeRequest),
          () => endStream(nodeRequest),
          reject,
        );
      } else {
        const nodeReadable = (
          fetchRequest.body != null
            ? isNodeReadable(fetchRequest.body)
              ? fetchRequest.body
              : Readable.from(fetchRequest.body)
            : null
        ) as Readable | null;
        if (nodeReadable) {
          nodeReadable.pipe(nodeRequest);
        } else {
          endStream(nodeRequest);
        }
      }
    } catch (e) {
      reject(e);
    }
  });
}
