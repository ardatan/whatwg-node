import { STATUS_CODES } from 'node:http';
import { PassThrough, Readable } from 'node:stream';
import zlib from 'node:zlib';
import type { Dispatcher } from 'undici';
import { fakeRejectPromise } from '@whatwg-node/promise-helpers';
import { getHttpsCheckServerIdentity } from './checkServerIdentity.js';
import { getUndici } from './getUndici.js';
import { PonyfillRequest } from './Request.js';
import { PonyfillResponse } from './Response.js';
import {
  DEFAULT_ACCEPT_ENCODING,
  getHeadersObj,
  isNodeReadable,
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
    const agent = new undici.Agent({
      allowH2: true,
      ...(checkServerIdentity
        ? {
            connect: {
              checkServerIdentity,
            },
          }
        : {}),
    });
    // dns → redirect → decompress → agent. Per-request `maxRedirections` overrides
    // redirect (0 = manual/error passthrough, >0 = follow).
    sharedAgent = agent.compose(
      undici.interceptors.dns({ maxTTL: 10 * 60 * 1000 }),
      undici.interceptors.redirect(),
      undici.interceptors.decompress(),
    );
  }
  return sharedAgent;
}

/**
 * `interceptors.decompress` does not handle deflate-raw; keep a tiny fallback.
 */
function createDeflateRawFallback(contentEncoding: string | string[] | undefined) {
  const encoding = Array.isArray(contentEncoding)
    ? contentEncoding[0]
    : contentEncoding?.split(',')[0]?.trim();
  if (encoding === 'deflate-raw' || encoding === 'x-deflate-raw') {
    return zlib.createInflateRaw();
  }
  return undefined;
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

function maxRedirectionsFor(redirect: RequestRedirect | undefined): number {
  // Fetch `follow` mirrors common undici/fetch defaults (20).
  return redirect === 'follow' ? 20 : 0;
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

  if (signal?.aborted) {
    return fakeRejectPromise(signal.reason ?? new Error('The operation was aborted.'));
  }

  const requestUrl = fetchRequest.parsedUrl || fetchRequest.url;
  const parsedUrl = undici.parseURL(requestUrl);
  const body = getRequestBody(fetchRequest);
  const agent = getSharedAgent();

  return new Promise<PonyfillResponse<TResponseJSON>>((resolve, reject) => {
    let outputStream: PassThrough | undefined;
    let settled = false;
    let redirectHistoryLength = 0;
    let dispatchController: { abort: (reason?: unknown) => void } | undefined;
    let removeAbortListener: (() => void) | undefined;

    function settleReject(error: unknown) {
      if (settled) {
        outputStream?.destroy(error as Error);
        return;
      }
      settled = true;
      removeAbortListener?.();
      reject(error);
    }

    function settleResolve(response: PonyfillResponse<TResponseJSON>) {
      if (settled) {
        return;
      }
      settled = true;
      removeAbortListener?.();
      resolve(response);
    }

    if (signal) {
      const onAbort = () => {
        const reason = signal.reason ?? new Error('The operation was aborted.');
        dispatchController?.abort(reason);
        settleReject(reason);
      };
      signal.addEventListener('abort', onAbort, { once: true });
      removeAbortListener = () => signal.removeEventListener('abort', onAbort);
    }

    try {
      agent.dispatch(
        {
          origin: parsedUrl.origin,
          path: parsedUrl.search ? `${parsedUrl.pathname}${parsedUrl.search}` : parsedUrl.pathname,
          method: fetchRequest.method as Dispatcher.HttpMethod,
          headers,
          body: body ?? undefined,
          // @ts-expect-error undici redirect interceptor reads this from dispatch opts
          maxRedirections: maxRedirectionsFor(fetchRequest.redirect),
        },
        {
          onRequestStart(controller, context) {
            dispatchController = controller;
            if (Array.isArray(context?.history)) {
              redirectHistoryLength = context.history.length;
            }
            if (signal?.aborted) {
              controller.abort(signal.reason ?? new Error('The operation was aborted.'));
            }
          },
          onResponseStart(controller, statusCode, responseHeaders, statusMessage) {
            if (statusCode < 200) {
              return;
            }

            const locationHeader = responseHeaders.location;
            const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;

            // maxRedirections: 0 leaves 3xx to us for Fetch redirect: 'error' | 'manual'.
            if (
              fetchRequest.redirect === 'error' &&
              location &&
              shouldRedirect(statusCode)
            ) {
              settleReject(new Error('Redirects are not allowed'));
              controller.abort();
              return;
            }

            outputStream =
              createDeflateRawFallback(responseHeaders['content-encoding']) || new PassThrough();

            outputStream.on('drain', () => {
              controller.resume();
            });
            outputStream.on('error', err => {
              controller.abort(err);
            });

            let statusText = statusMessage || STATUS_CODES[statusCode];
            if (statusText == null) {
              statusText = '';
            }

            const response = new PonyfillResponse(outputStream, {
              status: statusCode,
              statusText,
              headers: responseHeaders as Record<string, string | string[]>,
              url: fetchRequest.url,
              signal,
            });
            if (redirectHistoryLength > 0) {
              response.redirected = true;
            }
            settleResolve(response);
          },
          onResponseData(controller, chunk) {
            if (!outputStream) {
              return;
            }
            if (!outputStream.write(chunk)) {
              controller.pause();
            }
          },
          onResponseEnd() {
            removeAbortListener?.();
            outputStream?.end();
          },
          onResponseError(_controller, error) {
            settleReject(error);
            outputStream?.destroy(error);
          },
        },
      );
    } catch (error) {
      settleReject(error);
    }
  });
}
