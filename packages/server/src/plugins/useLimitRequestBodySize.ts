import type { FetchAPI } from '../types.js';
import type { ServerAdapterPlugin } from './types.js';
import { HTTPError } from './useErrorHandling.js';

export class RequestBodyTooLargeError extends HTTPError {
  name = 'RequestBodyTooLargeError';
  constructor(message = 'Request body too large') {
    super(413, message);
  }
}

export class InvalidContentLengthError extends HTTPError {
  name = 'InvalidContentLengthError';
  constructor(message = 'Content-Length header is invalid.') {
    super(400, message);
  }
}

export type LimitRequestBodySizeOptions = {
  /**
   * Maps early-reject errors (invalid `Content-Length` / body too large) to an HTTP `Response`
   * used with `endResponse`. Defaults to a plain-text body with the error status and message.
   *
   * Frameworks such as GraphQL Yoga can supply a factory that returns a GraphQL error payload.
   */
  responseFromError?: (error: HTTPError, fetchAPI: FetchAPI) => Response;
};

// Only a single non-negative integer is a valid Content-Length. Anything else (non-numeric,
// negative, or multiple comma-joined values as seen in request-smuggling attempts) is rejected
// outright instead of being allowed to silently skip this check.
const CONTENT_LENGTH_RE = /^\d+$/;

function defaultResponseFromError(error: HTTPError, fetchAPI: FetchAPI) {
  return new fetchAPI.Response(error.message, {
    status: error.status,
    headers: error.headers,
  });
}

/**
 * Limits the size of incoming HTTP request bodies.
 *
 * Requests whose `Content-Length` exceeds `limit` (or whose `Content-Length` is invalid) are
 * rejected early via `endResponse`. Bodies are also counted while streaming, so chunked or
 * missing `Content-Length` requests are covered too.
 *
 * To disable limiting, omit this plugin from the adapter.
 */
export function useLimitRequestBodySize<TServerContext = {}>(
  limit: number,
  options?: LimitRequestBodySizeOptions,
): ServerAdapterPlugin<TServerContext> {
  const responseFromError = options?.responseFromError ?? defaultResponseFromError;

  return {
    onRequest({ request, setRequest, fetchAPI, endResponse }) {
      const contentLength = request.headers.get('content-length');
      if (contentLength != null) {
        if (!CONTENT_LENGTH_RE.test(contentLength)) {
          endResponse(responseFromError(new InvalidContentLengthError(), fetchAPI));
          return;
        }
        if (Number(contentLength) > limit) {
          endResponse(responseFromError(new RequestBodyTooLargeError(), fetchAPI));
          return;
        }
      }

      if (!request.body) {
        return;
      }

      let bytesRead = 0;
      const limitedBody = request.body.pipeThrough(
        new fetchAPI.TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            bytesRead += chunk.byteLength;
            if (bytesRead > limit) {
              controller.error(new RequestBodyTooLargeError());
              return;
            }
            controller.enqueue(chunk);
          },
        }),
      );

      setRequest(
        new fetchAPI.Request(request.url, {
          body: limitedBody,
          cache: request.cache,
          credentials: request.credentials,
          headers: request.headers,
          integrity: request.integrity,
          keepalive: request.keepalive,
          method: request.method,
          mode: request.mode,
          redirect: request.redirect,
          referrer: request.referrer,
          referrerPolicy: request.referrerPolicy,
          signal: request.signal,
          // @ts-expect-error duplex is required for streamed bodies in some runtimes
          duplex: 'half',
        }),
      );
    },
  };
}
