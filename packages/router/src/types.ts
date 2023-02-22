import { ServerAdapter, ServerAdapterBaseObject, ServerAdapterPlugin } from '@whatwg-node/server';
import type {
  HTTPMethod,
  TypedRequest,
  TypedResponse,
  TypedResponseWithJSONStatusMap,
} from '@whatwg-node/typed-fetch';
import { FromSchema, JSONSchema } from 'json-schema-to-ts';

type PromiseOrValue<T> = T | Promise<T>;

export type TypedRouterHandlerTypeConfig<
  TRequestJSON,
  TRequestHeaders extends Record<string, string>,
  TRequestQueryParams extends Record<string, string | string[]>,
  TRequestPathParams extends Record<string, any>,
  TResponseJSONStatusMap extends Record<number, any>,
> = {
  Request: {
    JSON?: TRequestJSON;
    Headers?: TRequestHeaders;
    QueryParams?: TRequestQueryParams;
    PathParams?: TRequestPathParams;
  };
  Responses: TResponseJSONStatusMap;
};

export type RouterHandler<
  TServerContext,
  TMethod extends HTTPMethod = HTTPMethod,
  TRequestJSON = any,
  TRequestHeaders extends Record<string, string> = Record<string, string>,
  TRequestQueryParams extends Record<string, string | string[]> = Record<string, string | string[]>,
  TRequestPathParams extends Record<string, any> = Record<string, any>,
  TResponseJSONStatusMap extends Record<number, any> = Record<number, any>,
> = (
    request: TypedRequest<TRequestJSON, TRequestHeaders, TMethod, TRequestQueryParams, TRequestPathParams>,
  ctx: TServerContext,
) => PromiseOrValue<TypedResponseWithJSONStatusMap<TResponseJSONStatusMap> | void>;

export type RouterMethod<TServerContext, TMethod extends HTTPMethod> = <
  TTypeConfig extends TypedRouterHandlerTypeConfig<
    any,
    Record<string, string>,
    Record<string, string | string[]>,
    Record<string, any>,
    Record<number, any>
  >,
>(
  path: string,
  ...handlers: RouterHandler<
    TServerContext,
    TMethod,
    TTypeConfig['Request']['JSON'],
    TTypeConfig['Request']['Headers'] extends Record<string, string> ? TTypeConfig['Request']['Headers'] : Record<string, string>,
    TTypeConfig['Request']['QueryParams'] extends Record<string, string | string[]> ? TTypeConfig['Request']['QueryParams'] : Record<string, string | string[]>,
    TTypeConfig['Request']['PathParams'] extends Record<string, any> ? TTypeConfig['Request']['PathParams'] : Record<string, any>,
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
   {
    addRoute: AddRouteMethod;
   }
&
  ServerAdapterBaseObject<TServerContext>;

export type Router<TServerContext> = ServerAdapter<
  TServerContext,
  RouterBaseObject<TServerContext>
>;

export type OnRouteHook<TServerContext> = (payload: OnRouteHookPayload<TServerContext>) => void;

export type OnRouteHookPayload<TServerContext> = {
  method: HTTPMethod;
  path: string;
  schemas?: RouteSchemas;
  handlers: RouterHandler<TServerContext>[];
};

export type OnRouterInitHook<TServerContext> = (router: Router<TServerContext>) => void;

export type RouterPlugin<TServerContext> = ServerAdapterPlugin<TServerContext> & {
  onRouterInit?: OnRouterInitHook<TServerContext>;
  onRoute?: OnRouteHook<TServerContext>;
};
export type RouteSchemas = {
  Request?: {
    Headers?: JSONSchema;
    PathParams?: JSONSchema;
    QueryParams?: JSONSchema;
    JSONBody?: JSONSchema;
  };
  Responses?: Record<number, JSONSchema>;
};

export type AddRouteMethod = <TServerContext, TRouteSchemas extends RouteSchemas, TMethod extends HTTPMethod>(opts: {
  method: TMethod,
  path: string,
  schemas: TRouteSchemas,
  handler: (
    request: TRouteSchemas extends { Request: Required<RouteSchemas>['Request'] } ? TypedRequest<
      TRouteSchemas['Request'] extends { JSONBody: JSONSchema } ? FromSchema<TRouteSchemas['Request']['JSONBody']> : any,
      TRouteSchemas['Request'] extends { Headers: JSONSchema } ? FromSchema<TRouteSchemas['Request']['Headers']> extends Record<string, string> ? FromSchema<TRouteSchemas['Request']['Headers']> : Record<string, string> : Record<string, string>,
      TMethod,
      TRouteSchemas['Request'] extends { QueryParams: JSONSchema } ? FromSchema<TRouteSchemas['Request']['QueryParams']> extends Record<string, string> ? FromSchema<TRouteSchemas['Request']['QueryParams']> : Record<string, string | string[]> : Record<string, string | string[]>,
      TRouteSchemas['Request'] extends { PathParams: JSONSchema } ? FromSchema<TRouteSchemas['Request']['PathParams']> extends Record<string, string> ? FromSchema<TRouteSchemas['Request']['PathParams']> : Record<string, any> : Record<string, any>
    > : TypedRequest,
  ) => PromiseOrValue<
    TRouteSchemas extends { Responses: Record<number, JSONSchema> } ? TypedResponseWithJSONStatusMap<{
      [TStatusCode in keyof TRouteSchemas['Responses']]: TRouteSchemas['Responses'][TStatusCode] extends JSONSchema ? FromSchema<TRouteSchemas['Responses'][TStatusCode]> : never;
    }> : TypedResponse
  >,
}) => Router<TServerContext>;
