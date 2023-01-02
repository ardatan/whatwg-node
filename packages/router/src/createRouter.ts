import { createServerAdapter, type DefaultServerAdapterContext } from '@whatwg-node/server';
import { Request as DefaultRequestCtor, URLPattern } from '@whatwg-node/fetch';
import type { HTTPMethod, RouteMethodKey, Router, RouterBaseObject, RouterHandler, RouterRequest } from './types';

interface RouterOptions<TServerContext = DefaultServerAdapterContext> {
  base?: string;
  RequestCtor?: typeof Request;
  plugins?: Array<(router: RouterBaseObject<TServerContext>) => RouterBaseObject<TServerContext>>;
}

const HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH'] as HTTPMethod[];

export function createRouter<TServerContext = DefaultServerAdapterContext>(
  options?: RouterOptions<TServerContext>
): Router<TServerContext> {
  const pathPatternMap = new Map<string, URLPattern>();
  function getPatternForPath(path: string) {
    let pattern = pathPatternMap.get(path);
    if (!pattern) {
      pattern = new URLPattern({ pathname: path });
      pathPatternMap.set(path, pattern);
    }
    return pattern;
  }
  const routesByMethod = new Map<HTTPMethod, Map<URLPattern, RouterHandler<TServerContext>[]>>();
  function addHandlersToMethod(method: HTTPMethod, path: string, ...handlers: RouterHandler<TServerContext>[]) {
    let methodPatternMaps = routesByMethod.get(method);
    if (!methodPatternMaps) {
      methodPatternMaps = new Map();
      routesByMethod.set(method, methodPatternMaps);
    }
    const pattern = getPatternForPath(options?.base ? `${options.base}${path}` : path);
    let methodPatternHandlers = methodPatternMaps.get(pattern);
    if (!methodPatternHandlers) {
      methodPatternHandlers = [];
      methodPatternMaps.set(pattern, methodPatternHandlers);
    }
    methodPatternHandlers.push(...handlers);
  }
  async function handleRequest(request: Request, context: TServerContext) {
    const method = request.method as HTTPMethod;
    const parsedUrl = new URL(request.url);
    const methodPatternMaps = routesByMethod.get(method);
    if (methodPatternMaps) {
      for (const [pattern, handlers] of methodPatternMaps) {
        const match = pattern.exec(parsedUrl);
        if (match) {
          const queryProxy = new Proxy({}, {
            get(_, prop) {
              return parsedUrl.searchParams.get(prop.toString());
            },
            has(_, prop) {
              return parsedUrl.searchParams.has(prop.toString());
            }
          })
          const routerRequest = new Proxy(request, {
            get(target, prop, receiver) {
              if (prop === 'parsedUrl') {
                return parsedUrl;
              }
              if (prop === 'params') {
                return match.pathname.groups;
              }
              if (prop === 'query') {
                return queryProxy;
              }
              return Reflect.get(target, prop, receiver);
            },
            has(target, prop) {
              return prop in target || prop === 'parsedUrl' || prop === 'params' || prop === 'query';
            }
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
  let routerBaseObject = new Proxy({} as RouterBaseObject<TServerContext>, {
    get(_, prop) {
      if (prop === 'handle') {
        return handleRequest;
      }
      const method = prop.toString().toLowerCase() as RouteMethodKey;
      return function routeMethodKeyFn(this: RouterBaseObject<TServerContext>, path: string, ...handlers: RouterHandler<TServerContext>[]) {
        if(method === 'all') {
          for (const httpMethod of HTTP_METHODS) {
            addHandlersToMethod(httpMethod, path, ...handlers);
          }
        } else {
          addHandlersToMethod(method.toUpperCase() as HTTPMethod, path, ...handlers);
        }
        return this;
      }
    }
  }) 
  options?.plugins?.forEach(plugin => {
    routerBaseObject = plugin(routerBaseObject);
  });
  return createServerAdapter(routerBaseObject, options?.RequestCtor || DefaultRequestCtor);
}
