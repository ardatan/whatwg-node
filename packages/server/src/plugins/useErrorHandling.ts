import { Response as DefaultResponseCtor } from '@whatwg-node/fetch';
import { ServerAdapterPlugin } from './types';

export function createDefaultErrorHandler<TServerContext = {}>(
  ResponseCtor: typeof Response = DefaultResponseCtor,
): ErrorHandler<TServerContext> {
  return function defaultErrorHandler(e: any): Response | Promise<Response> {
    return new ResponseCtor(
      typeof e.details === 'object'
        ? JSON.stringify(e.details)
        : e.stack || e.message || e.toString(),
      {
        status: e.statusCode || e.status || 500,
        headers: e.headers || {},
      },
    );
  };
}

export class HTTPError extends Error {
  constructor(
    public status: number,
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
      setRequestHandler(async function handlerWithErrorHandling(
        request: Request,
        serverContext: TServerContext,
      ): Promise<Response> {
        try {
          const response = await requestHandler(request, serverContext);
          return response;
        } catch (e) {
          const response = await errorHandler(e, request, serverContext);
          return response;
        }
      });
    },
  };
}
