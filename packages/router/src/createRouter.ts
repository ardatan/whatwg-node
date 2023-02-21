import * as DefaultFetchAPI from '@whatwg-node/fetch';
import { createServerAdapter, ServerAdapterOptions } from '@whatwg-node/server';
import type {
  HTTPMethod,
  RouteMethodKey,
  Router,
  RouterBaseObject,
  RouterHandler,
  RouterRequest,
} from './types';

interface RouterOptions<TServerContext = {}> extends ServerAdapterOptions<TServerContext> {
  base?: string;
}

const HTTP_METHODS = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'CONNECT',
  'OPTIONS',
  'TRACE',
  'PATCH',
] as HTTPMethod[];

export function createRouterBase<TServerContext = {}>({
  fetchAPI: givenFetchAPI,
  base: basePath = '/',
}: RouterOptions<TServerContext> = {}): RouterBaseObject<TServerContext> {
  const fetchAPI = {
    ...givenFetchAPI,
    ...DefaultFetchAPI,
  };
  const routesByMethod = new Map<HTTPMethod, Map<URLPattern, RouterHandler<TServerContext>[]>>();
  function addHandlersToMethod(
    method: HTTPMethod,
    path: string,
    ...handlers: RouterHandler<TServerContext>[]
  ) {
    let methodPatternMaps = routesByMethod.get(method);
    if (!methodPatternMaps) {
      methodPatternMaps = new Map();
      routesByMethod.set(method, methodPatternMaps);
    }
    let fullPath = '';
    if (basePath === '/') {
      fullPath = path;
    } else if (path === '/') {
      fullPath = basePath;
    } else {
      fullPath = `${basePath}${path}`;
    }
    const pattern = new fetchAPI.URLPattern({ pathname: fullPath });
    methodPatternMaps.set(pattern, handlers);
  }
  async function handleRequest(request: Request, context: TServerContext) {
    const method = request.method as HTTPMethod;
    let _parsedUrl: URL;
    function getParsedUrl() {
      if (!_parsedUrl) {
        _parsedUrl = new fetchAPI.URL(request.url);
      }
      return _parsedUrl;
    }
    const methodPatternMaps = routesByMethod.get(method);
    if (methodPatternMaps) {
      const queryProxy = new Proxy(
        {},
        {
          get(_, prop) {
            const parsedUrl = getParsedUrl();
            const allQueries = parsedUrl.searchParams.getAll(prop.toString());
            return allQueries.length === 1 ? allQueries[0] : allQueries;
          },
          has(_, prop) {
            const parsedUrl = getParsedUrl();
            return parsedUrl.searchParams.has(prop.toString());
          },
        },
      );
      for (const [pattern, handlers] of methodPatternMaps) {
        const match = pattern.exec(request.url);
        if (match) {
          const routerRequest = new Proxy(request, {
            get(target, prop: keyof RouterRequest) {
              if (prop === 'parsedUrl') {
                return getParsedUrl();
              }
              if (prop === 'params') {
                return new Proxy(match.pathname.groups, {
                  get(_, prop) {
                    const value = match.pathname.groups[prop.toString()];
                    if (value != null) {
                      return decodeURIComponent(value);
                    }
                    return value;
                  },
                });
              }
              if (prop === 'query') {
                return queryProxy;
              }
              const targetProp = target[prop];
              if (typeof targetProp === 'function') {
                return targetProp.bind(target);
              }
              return targetProp;
            },
            has(target, prop) {
              return (
                prop in target || prop === 'parsedUrl' || prop === 'params' || prop === 'query'
              );
            },
          }) as RouterRequest;
          for (const handler of handlers) {
            const result = await handler(routerRequest as RouterRequest, context);
            if (result) {
              return result;
            }
          }
        }
      }
    }
  }
  return new Proxy({} as RouterBaseObject<TServerContext>, {
    get(_, prop) {
      if (prop === 'handle') {
        return handleRequest;
      }
      const method = prop.toString().toLowerCase() as RouteMethodKey;
      return function routeMethodKeyFn(
        this: RouterBaseObject<TServerContext>,
        path: string,
        ...handlers: RouterHandler<TServerContext>[]
      ) {
        if (method === 'all') {
          for (const httpMethod of HTTP_METHODS) {
            addHandlersToMethod(httpMethod, path, ...handlers);
          }
        } else {
          addHandlersToMethod(method.toUpperCase() as HTTPMethod, path, ...handlers);
        }
        return this;
      };
    },
  });
}

export function createRouter<TServerContext = {}>(
  options?: RouterOptions<TServerContext>,
): Router<TServerContext> {
  const routerBaseObject = createRouterBase(options);
  return createServerAdapter(routerBaseObject, options);
}
