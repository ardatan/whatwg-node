import { ServerAdapter, ServerAdapterBaseObject } from '@whatwg-node/server';

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface RouterRequest extends Request {
  method: HTTPMethod;
  parsedUrl: URL;
  params: Record<string, string>;
  query: Record<string, string>;
}

export type RouteMethodKey = Lowercase<HTTPMethod> | 'all';
export type RouterHandler<TServerContext> = (
  request: RouterRequest,
  ctx: TServerContext
) => Promise<Response | void> | Response | void;
export type RouteMethod<TServerContext> = (
  path: string,
  handler: RouterHandler<TServerContext>
) => Router<TServerContext>;

export type RouterBaseObject<TServerContext> = Record<RouteMethodKey, RouteMethod<TServerContext>> &
  ServerAdapterBaseObject<TServerContext>;
export type Router<TServerContext> = ServerAdapter<TServerContext, RouterBaseObject<TServerContext>>;
