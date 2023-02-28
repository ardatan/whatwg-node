import Ajv, { ErrorObject } from 'ajv';
import { Response, RouterPlugin, RouterRequest } from '@whatwg-node/router';

type ValidateRequestFn = (request: RouterRequest) => Promise<any>;

export interface AJVPluginOptions {
  ajv: Ajv;
  request: {
    headers: boolean;
    params: boolean;
    query: boolean;
    json: boolean;
  };
}

export function useAJV({ ajv, request }: AJVPluginOptions): RouterPlugin<any> {
  return {
    onRoute({ schemas, handlers }) {
      const validationMiddlewares = new Map<string, ValidateRequestFn>();
      if (request.headers && schemas?.request?.headers) {
        const validateFn = ajv.compile({ ...schemas.request.headers, $async: true });
        validationMiddlewares.set('headers', request => {
          const headersObj: any = {};
          request.headers.forEach((value, key) => {
            headersObj[key] = value;
          });
          return validateFn(headersObj);
        });
      }
      if (request.params && schemas?.request?.params) {
        const validateFn = ajv.compile({ ...schemas.request.params, $async: true });
        validationMiddlewares.set('params', request => {
          return validateFn(request.params);
        });
      }
      if (request.query && schemas?.request?.query) {
        const validateFn = ajv.compile({
          ...schemas.request.query,
          $async: true,
        });
        validationMiddlewares.set('query', request => {
          return validateFn(request.query);
        });
      }
      if (request.json && schemas?.request?.json) {
        const validateFn = ajv.compile({ ...schemas.request.json, $async: true });
        validationMiddlewares.set('json', async request => {
          const jsonObj = await request.json();
          Object.defineProperty(request, 'json', {
            value: async () => jsonObj,
          });
          return validateFn(jsonObj);
        });
      }
      if (validationMiddlewares.size > 0) {
        handlers.unshift(async (request): Promise<any> => {
          const validationErrorsNonFlat = await Promise.all(
            [...validationMiddlewares.entries()].map(async ([name, fn]) => {
              try {
                await fn(request);
              } catch (e) {
                if (e instanceof Ajv.ValidationError) {
                  return e.errors.map(error => ({
                    ...error,
                    name,
                  }));
                }
                throw e;
              }
            }),
          );
          const validationErrors = validationErrorsNonFlat.flat().filter(Boolean) as ErrorObject[];
          if (validationErrors.length > 0) {
            return Response.json(
              {
                errors: validationErrors,
              },
              {
                status: 400,
                headers: {
                  'x-error-type': 'validation',
                },
              },
            );
          }
        });
      }
    },
  };
}
