import { abortSignalAny } from '../abortSignalAny.js';
import type { ServerAdapterInitialContext } from '../types.js';
import type { ServerAdapterPlugin } from './types.js';

export interface RequestDeadlineOptions<TServerContext = {}> {
  /**
   * The timeout in milliseconds after which the request should be considered as "timed out" and
   * the deadline response should be produced.
   *
   * The deadline timeout is different from Node's `requestTimeout` or `headersTimeout` as it is not
   * related to the time spent _waiting_ for the request to be received or the headers to be parsed.
   * Instead, it is related to the total time spent processing the request, including the time spent
   * in the request handler and all the plugins hooks.
   */
  timeout: number;
  /**
   * A function that produces the response to be sent when the deadline is reached. It receives the
   * original request and the server context as parameters, so you can use them to produce a more
   * informed response.
   */
  response: (request: Request, ctx: TServerContext & ServerAdapterInitialContext) => Response;
}

/**
 * A plugin that allows you to set a deadline for each request. If the request takes longer than
 * the specified timeout, the plugin will produce a response using the provided response factory function.
 *
 * This plugin is useful to prevent requests from taking too long and to provide a better experience
 * for the clients by sending a timely response when the server is under heavy load or when there are
 * long-running requests.
 *
 * This plugin also aborts the request signal when the deadline is reached. This means that if the
 * request handler, or any of the plugins hooks, are listening to the request signal, they will be able
 * to react to the deadline being reached and perform any necessary cleanup operations.
 */
export function useRequestDeadline<TServerContext = {}>(
  opts: RequestDeadlineOptions<TServerContext>,
): ServerAdapterPlugin<TServerContext> {
  return {
    onRequest({ request, setRequest, requestHandler, setRequestHandler, fetchAPI }) {
      const deadlineSignal = AbortSignal.timeout(opts.timeout);
      const composedSignal = abortSignalAny([request.signal, deadlineSignal])!;
      // TODO: replace with new fetchAPI.Request(request, { signal: composedSignal }) once
      // node-fetch (used by the ponyfill) can copy-construct a Request whose body is a
      // PonyfillReadableStream - right now it silently drops the body in that case.
      // constructing from url + explicit fields is the workaround that keeps the body intact.
      setRequest(
        new fetchAPI.Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          signal: composedSignal,
          cache: request.cache,
          credentials: request.credentials,
          integrity: request.integrity,
          keepalive: request.keepalive,
          mode: request.mode,
          redirect: request.redirect,
          referrer: request.referrer,
          referrerPolicy: request.referrerPolicy,
          // 'half' duplex is required by the fetch spec when the request has a streaming body -
          // without it, Node.js native fetch rejects the request with a TypeError at construction time.
          // @ts-expect-error - not yet in the TypeScript lib types for RequestInit
          duplex: 'half',
        }),
      );

      setRequestHandler(function handlerWithDeadline(req, ctx) {
        if (deadlineSignal.aborted) {
          return opts.response(req, ctx);
        }
        return new Promise((resolve, reject) => {
          deadlineSignal.addEventListener(
            'abort',
            () => {
              resolve(opts.response(req, ctx));
            },
            { once: true },
          );
          const $ = requestHandler(req, ctx);
          if ($ instanceof Promise) {
            $.then(resolve, reject);
          } else {
            resolve($);
          }
        });
      });
    },
  };
}
