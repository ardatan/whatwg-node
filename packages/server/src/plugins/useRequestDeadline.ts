import { abortSignalAny } from '@graphql-hive/signal';
import type { ServerAdapterPlugin } from './types.js';

export interface RequestDeadlineOptions {
  timeoutInMs: number;
  response: (request: Request) => Response;
}

export function useRequestDeadline<TServerContext>(
  opts: RequestDeadlineOptions,
): ServerAdapterPlugin<TServerContext> {
  return {
    onRequest({ request, setRequest, requestHandler, setRequestHandler, fetchAPI }) {
      const deadlineSignal = AbortSignal.timeout(opts.timeoutInMs);
      const composedSignal = abortSignalAny([request.signal, deadlineSignal])!;
      setRequest(new fetchAPI.Request(request, { signal: composedSignal }));

      setRequestHandler(function handlerWithDeadline(req, ctx) {
        if (deadlineSignal.aborted) {
          return opts.response(req);
        }
        return new Promise((resolve, reject) => {
          deadlineSignal.addEventListener(
            'abort',
            () => {
              resolve(opts.response(req));
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
