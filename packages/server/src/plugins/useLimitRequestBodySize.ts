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
 * When `Content-Length` is present and valid, the limit is applied from that header alone and the
 * `Request` identity is left unchanged. `@whatwg-node/node-fetch` enforces that the body cannot
 * deliver more bytes than `Content-Length` while it is being read (fail-fast on excess), so a
 * short `Content-Length` cannot bypass the limit on the ponyfill path. On Node's HTTP parser the
 * body is already framed to `Content-Length`, so the same trust holds for native `Request`s built
 * from `IncomingMessage`.
 *
 * When `Content-Length` is missing (e.g. chunked transfer), bodies are counted while streaming via
 * `TransformStream` (which replaces the `Request`). `Transfer-Encoding` / `Content-Encoding` cases
 * without a usable length fall into that path.
 *
 * When using `useContentEncoding`, register it **before** this plugin so a missing
 * `Content-Length` after decoding is still byte-counted on decoded bytes. `onRequest` hooks run in
 * `plugins` array order; the reverse order would count compressed size and then allow decompression
 * past `limit`.
 *
 * To disable limiting, omit this plugin from the adapter.
 */
export function useLimitRequestBodySize<TServerContext = {}>(
  limit: number,
  options?: LimitRequestBodySizeOptions,
): ServerAdapterPlugin<TServerContext> {
  if (!Number.isFinite(limit) || limit < 0) {
    throw new TypeError(
      `useLimitRequestBodySize: expected a finite non-negative limit, got ${String(limit)}`,
    );
  }

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
        // Content-Length is within the limit. Trust it — do not replace the Request.
        return;
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
