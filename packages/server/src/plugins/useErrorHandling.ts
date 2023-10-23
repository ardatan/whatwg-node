import { Response as DefaultResponseCtor } from '@whatwg-node/fetch';
import { isPromise } from '../utils.js';
import { ServerAdapterPlugin } from './types.js';

export function createDefaultErrorHandler<TServerContext = {}>(
  ResponseCtor: typeof Response = DefaultResponseCtor,
): ErrorHandler<TServerContext> {
  return function defaultErrorHandler(e: any): Response | Promise<Response> {
    if (e.details || e.status || e.headers || e.name === 'HTTPError') {
      return new ResponseCtor(
        typeof e.details === 'object' ? JSON.stringify(e.details) : e.message,
        {
          status: e.status,
          headers: e.headers || {},
        },
      );
    }
    console.error(e);
    if (ResponseCtor.error) {
      return ResponseCtor.error();
    }
    return new ResponseCtor(null, { status: 500 });
  };
}

export class HTTPError extends Error {
  name = 'HTTPError';
  constructor(
    public status: number = 500,
    public message: string,
    public headers: HeadersInit = {},
    public details?: any,
  ) {
    super(message);
    Error.captureStackTrace(this, HTTPError);
  }
}

export type ErrorHandler<TServerContext> = (
  e: any,
  request: Request,
  ctx: TServerContext,
) => Response | Promise<Response>;

export function useErrorHandling<TServerContext>(
  onError?: ErrorHandler<TServerContext>,
): ServerAdapterPlugin<TServerContext> {
  return {
    onRequest({ requestHandler, setRequestHandler, fetchAPI }) {
      const errorHandler = onError || createDefaultErrorHandler<TServerContext>(fetchAPI.Response);
      setRequestHandler(function handlerWithErrorHandling(
        request: Request,
        serverContext: TServerContext,
      ): Promise<Response> | Response {
        try {
          const response$ = requestHandler(request, serverContext);
          if (isPromise(response$)) {
            return response$.catch(e => errorHandler(e, request, serverContext));
          }
          return response$;
        } catch (e) {
          return errorHandler(e, request, serverContext);
        }
      });
    },
  };
}
