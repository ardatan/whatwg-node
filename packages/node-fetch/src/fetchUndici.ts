import { STATUS_CODES } from 'node:http';
import { PassThrough, Readable } from 'node:stream';
import zlib from 'node:zlib';
import type { Dispatcher } from 'undici';
import { fakeRejectPromise } from '@whatwg-node/promise-helpers';
import { getHttpsCheckServerIdentity } from './checkServerIdentity.js';
import { getUndici } from './getUndici.js';
import { PonyfillRequest } from './Request.js';
import { PonyfillResponse } from './Response.js';
import { PonyfillURL } from './URL.js';
import {
  DEFAULT_ACCEPT_ENCODING,
  getHeadersObj,
  isNodeReadable,
  pipeThrough,
  shouldRedirect,
} from './utils.js';

let sharedAgent: Dispatcher | undefined;

function getSharedAgent(): Dispatcher {
  if (!sharedAgent) {
    const undici = getUndici();
    if (!undici) {
      throw new Error('undici is not available');
    }
    const checkServerIdentity = getHttpsCheckServerIdentity();
    sharedAgent = new undici.Agent({
      allowH2: true,
      ...(checkServerIdentity
        ? {
            connect: {
              checkServerIdentity,
            },
          }
        : {}),
    });
  }
  return sharedAgent;
}

function createDecompressionStream(contentEncoding: string | string[] | undefined) {
  const encoding = Array.isArray(contentEncoding)
    ? contentEncoding[0]
    : contentEncoding?.split(',')[0]?.trim();
  switch (encoding) {
    case 'x-gzip':
    case 'gzip':
      return zlib.createGunzip();
    case 'x-deflate':
    case 'deflate':
      return zlib.createInflate();
    case 'x-deflate-raw':
    case 'deflate-raw':
      return zlib.createInflateRaw();
    case 'br':
      return zlib.createBrotliDecompress();
    case 'zstd':
      return zlib.createZstdDecompress();
    default:
      return undefined;
  }
}

function getRequestBody(fetchRequest: PonyfillRequest): string | Buffer | Readable | null {
  if (fetchRequest['_buffer'] != null) {
    return fetchRequest['_buffer'] as Buffer;
  }
  if (fetchRequest['bodyType'] === 'String') {
    return fetchRequest['bodyInit'] as string;
  }
  if (fetchRequest.body == null) {
    return null;
  }
  return isNodeReadable(fetchRequest.body)
    ? (fetchRequest.body as Readable)
    : Readable.from(fetchRequest.body);
}

export function fetchUndici<TResponseJSON = any, TRequestJSON = any>(
  fetchRequest: PonyfillRequest<TRequestJSON>,
): Promise<PonyfillResponse<TResponseJSON>> {
  const undici = getUndici();
  if (!undici) {
    return fakeRejectPromise(new Error('undici is not available'));
  }

  const headersSerializer: typeof getHeadersObj =
    (fetchRequest.headersSerializer as any) || getHeadersObj;
  const headers = headersSerializer(fetchRequest.headers);
  headers['accept-encoding'] ||= DEFAULT_ACCEPT_ENCODING;
  if (headers['user-agent'] == null && headers['User-Agent'] == null) {
    headers['user-agent'] = 'node';
  }

  let signal: AbortSignal | undefined;
  if (fetchRequest._signal === null) {
    signal = undefined;
  } else if (fetchRequest._signal) {
    signal = fetchRequest._signal;
  }

  const requestUrl = fetchRequest.parsedUrl || fetchRequest.url;
  const body = getRequestBody(fetchRequest);

  return undici
    .request(requestUrl, {
      method: fetchRequest.method as Dispatcher.HttpMethod,
      headers,
      body: body ?? undefined,
      signal,
      dispatcher: getSharedAgent(),
    })
    .then(({ statusCode, headers: responseHeaders, body: responseBody, statusText }) => {
      const locationHeader = responseHeaders.location;
      const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;

      if (location && shouldRedirect(statusCode)) {
        if (fetchRequest.redirect === 'error') {
          responseBody.resume();
          throw new Error('Redirects are not allowed');
        }
        if (fetchRequest.redirect === 'follow') {
          const redirectedUrl = new PonyfillURL(
            location,
            fetchRequest.parsedUrl || fetchRequest.url,
          );
          responseBody.resume();
          return fetchUndici(new PonyfillRequest(redirectedUrl, fetchRequest)).then(
            redirectResponse => {
              redirectResponse.redirected = true;
              return redirectResponse;
            },
          );
        }
      }

      let outputStream = createDecompressionStream(responseHeaders['content-encoding']);
      outputStream ||= new PassThrough();

      pipeThrough({
        src: responseBody,
        dest: outputStream,
        signal,
        onError: e => {
          if (!responseBody.destroyed) {
            responseBody.destroy(e);
          }
          if (!outputStream!.destroyed) {
            outputStream!.destroy(e);
          }
        },
      });

      let resolvedStatusText = statusText || STATUS_CODES[statusCode];
      if (resolvedStatusText == null) {
        resolvedStatusText = '';
      }

      return new PonyfillResponse(outputStream, {
        status: statusCode,
        statusText: resolvedStatusText,
        headers: responseHeaders as Record<string, string | string[]>,
        url: fetchRequest.url,
        signal,
      });
    });
}
