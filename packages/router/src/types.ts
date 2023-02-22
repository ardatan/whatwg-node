import { ServerAdapter, ServerAdapterBaseObject, ServerAdapterPlugin } from '@whatwg-node/server';
import type {
  HTTPMethod,
  TypedBodyOpts,
  TypedRequest,
  TypedRequestOpts,
  TypedResponseWithJSONStatusMap,
  TypedURLOpts,
} from '@whatwg-node/typed-fetch';

type PromiseOrValue<T> = T | Promise<T>;

export type TypedRouterHandlerTypeConfig<
  TTypedRequestOpts extends TypedRequestOpts<
    TypedBodyOpts<any, any>,
    TypedURLOpts<any, any>,
    HTTPMethod
  >,
  TResponseJSONStatusMap extends Record<number, any>,
> = {
  Request: TTypedRequestOpts;
  Responses: TResponseJSONStatusMap;
};

export type RouterHandler<
  TServerContext,
  TMethod extends HTTPMethod,
  TTypedRequestOpts extends TypedRequestOpts<
    TypedBodyOpts<any, any>,
    TypedURLOpts<any, any>,
    TMethod
  >,
  TResponseJSONStatusMap extends Record<number, any>,
> = (
  request: TypedRequest<TTypedRequestOpts>,
  ctx: TServerContext,
) => PromiseOrValue<TypedResponseWithJSONStatusMap<TResponseJSONStatusMap> | void>;

export type RouterMethod<TServerContext, TMethod extends HTTPMethod> = <
  TTypeConfig extends TypedRouterHandlerTypeConfig<
    TypedRequestOpts<TypedBodyOpts<any, any>, TypedURLOpts<any, any>, TMethod>,
    Record<number, any>
  >,
>(
  path: string,
  ...handlers: RouterHandler<
    TServerContext,
    TMethod,
    TTypeConfig['Request'],
    TTypeConfig['Responses']
  >[]
) => Router<TServerContext>;

export type RouteMethodKey = HTTPMethod | 'all';

export type RouterMethodsObj<TServerContext> = {
  [TMethodKey in RouteMethodKey]: TMethodKey extends HTTPMethod
    ? RouterMethod<TServerContext, TMethodKey>
    : RouterMethod<TServerContext, HTTPMethod>;
};

export type RouterBaseObject<TServerContext> = RouterMethodsObj<TServerContext> &
  ServerAdapterBaseObject<TServerContext>;

export type Router<TServerContext> = ServerAdapter<
  TServerContext,
  RouterBaseObject<TServerContext>
>;

export type OnRouteHook<TServerContext> = (payload: OnRouteHookPayload<TServerContext>) => void;

export type OnRouteHookPayload<TServerContext> = {
  method: HTTPMethod;
  path: string;
  handlers: RouterHandler<TServerContext, any, any, any>[];
};

export type RouterPlugin<TServerContext> = ServerAdapterPlugin<TServerContext> & {
  onRoute?: OnRouteHook<TServerContext>;
};
