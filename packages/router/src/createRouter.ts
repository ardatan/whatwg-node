import * as DefaultFetchAPI from '@whatwg-node/fetch';
import { createServerAdapter, ServerAdapterOptions } from '@whatwg-node/server';
import { HTTPMethod, TypedRequest, TypedResponseCtor } from '@whatwg-node/typed-fetch';
import type {
  AddRouteMethod,
  OnRouteHook,
  OnRouterInitHook,
  RouteMethodKey,
  Router,
  RouterBaseObject,
  RouterHandler,
  RouterPlugin,
  RouteSchemas,
} from './types';

export interface RouterOptions<TServerContext = {}> extends ServerAdapterOptions<TServerContext> {
  base?: string;
  plugins?: RouterPlugin<TServerContext>[];
}

const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'delete',
  'head',
  'options',
  'patch',
  'trace',
] as HTTPMethod[];

export const Response: TypedResponseCtor = DefaultFetchAPI.Response as any;

export function createRouterBase<TServerContext = {}>({
  fetchAPI: givenFetchAPI,
  base: basePath = '/',
  plugins = [],
}: RouterOptions<TServerContext> = {}): RouterBaseObject<TServerContext> {
  const fetchAPI = {
    ...DefaultFetchAPI,
    ...givenFetchAPI,
  };
  const onRouterInit: OnRouterInitHook<TServerContext>[] = [];
  const onRouteHooks: OnRouteHook<TServerContext>[] = [];
  for (const plugin of plugins) {
    if (plugin.onRouterInit) {
      onRouterInit.push(plugin.onRouterInit);
    }
    if (plugin.onRoute) {
      onRouteHooks.push(plugin.onRoute);
    }
  }
  const routesByMethod = new Map<
    HTTPMethod,
    Map<URLPattern, RouterHandler<TServerContext, any, any, any>[]>
  >();
  function addHandlersToMethod({
    operationId,
    description,
    method,
    path,
    schemas,
    handlers,
  }: {
    operationId?: string;
    description?: string;
    method: HTTPMethod;
    path: string;
    schemas?: RouteSchemas;
    handlers: RouterHandler<TServerContext, any, any, any>[];
  }) {
    for (const onRouteHook of onRouteHooks) {
      onRouteHook({
        operationId,
        description,
        method,
        path,
        schemas,
        handlers,
      });
    }
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
    const method = request.method.toLowerCase() as HTTPMethod;
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
            get(target, prop: keyof TypedRequest) {
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
          });
          for (const handler of handlers) {
            const result = await handler(routerRequest as TypedRequest, context);
            if (result) {
              return result;
            }
          }
        }
      }
    }
  }
  const router = new Proxy({} as RouterBaseObject<TServerContext>, {
    get(_, prop) {
      if (prop === 'handle') {
        return handleRequest;
      }
      if (prop === 'addRoute') {
        return function (
          this: RouterBaseObject<TServerContext>,
          opts: Parameters<AddRouteMethod>[0],
        ) {
          const { operationId, description, method, path, schemas, handler } = opts;
          addHandlersToMethod({
            operationId,
            description,
            method,
            path,
            schemas,
            handlers: [handler],
          });
          return this;
        };
      }
      const method = prop.toString().toLowerCase() as RouteMethodKey;
      return function routeMethodKeyFn(
        this: RouterBaseObject<TServerContext>,
        path: string,
        ...handlers: RouterHandler<TServerContext>[]
      ) {
        if (method === 'all') {
          for (const httpMethod of HTTP_METHODS) {
            addHandlersToMethod({
              method: httpMethod.toLowerCase() as HTTPMethod,
              path,
              handlers,
            });
          }
        } else {
          addHandlersToMethod({
            method: method.toLowerCase() as HTTPMethod,
            path,
            handlers,
          });
        }
        return this;
      };
    },
  });
  for (const onRouterInitHook of onRouterInit) {
    onRouterInitHook(router as Router<TServerContext>);
  }
  return router;
}

export function createRouter<TServerContext = any>(
  options?: RouterOptions<TServerContext>,
): Router<TServerContext> {
  const routerBaseObject = createRouterBase(options);
  return createServerAdapter(routerBaseObject, options);
}
