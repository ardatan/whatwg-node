import { abortSignalAny } from '@graphql-hive/signal';
import type { ServerAdapterInitialContext } from '../types.js';
import type { ServerAdapterPlugin } from './types.js';

export interface RequestDeadlineOptions<TServerContext = {}> {
  timeout: number;
  response: (request: Request, ctx: TServerContext & ServerAdapterInitialContext) => Response;
}

export function useRequestDeadline<TServerContext = {}>(
  opts: RequestDeadlineOptions<TServerContext>,
): ServerAdapterPlugin<TServerContext> {
  return {
    onRequest({ request, setRequest, requestHandler, setRequestHandler, fetchAPI }) {
      const deadlineSignal = AbortSignal.timeout(opts.timeout);
      const composedSignal = abortSignalAny([request.signal, deadlineSignal])!;
      setRequest(new fetchAPI.Request(request, { signal: composedSignal }));

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
