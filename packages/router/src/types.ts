import { FromSchema, JSONSchema } from 'json-schema-to-ts';
import { ServerAdapter, ServerAdapterBaseObject, ServerAdapterPlugin } from '@whatwg-node/server';
import type {
  HTTPMethod,
  TypedRequest,
  TypedResponse,
  TypedResponseWithJSONStatusMap,
} from '@whatwg-node/typed-fetch';

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
  request: TypedRequest<
    TRequestJSON,
    TRequestHeaders,
    TMethod,
    TRequestQueryParams,
    TRequestPathParams
  >,
  ctx: TServerContext,
) => PromiseOrValue<TypedResponseWithJSONStatusMap<TResponseJSONStatusMap> | void>;

export type RouterMethod<
  TServerContext,
  TMethod extends HTTPMethod,
  TRouterSDK extends RouterSDK<string, TypedRequest, TypedResponse>,
> = <
  TTypeConfig extends TypedRouterHandlerTypeConfig<
    any,
    Record<string, string>,
    Record<string, string | string[]>,
    Record<string, any>,
    Record<number, any>
  >,
  TPath extends string = string,
>(
  path: TPath,
  ...handlers: RouterHandler<
    TServerContext,
    TMethod,
    TTypeConfig['Request']['JSON'],
    TTypeConfig['Request']['Headers'] extends Record<string, string>
      ? TTypeConfig['Request']['Headers']
      : Record<string, string>,
    TTypeConfig['Request']['QueryParams'] extends Record<string, string | string[]>
      ? TTypeConfig['Request']['QueryParams']
      : Record<string, string | string[]>,
    TTypeConfig['Request']['PathParams'] extends Record<string, any>
      ? TTypeConfig['Request']['PathParams']
      : Record<string, any>,
    TTypeConfig['Responses']
  >[]
) => Router<TServerContext, TRouterSDK & RouterSDK<TPath, TypedRequest, TypedResponse>>;

export type RouteMethodKey = HTTPMethod | 'all';

export type RouterMethodsObj<
  TServerContext,
  TRouterSDK extends RouterSDK<string, TypedRequest, TypedResponse>,
> = {
  [TMethodKey in RouteMethodKey]: TMethodKey extends HTTPMethod
    ? RouterMethod<TServerContext, TMethodKey, TRouterSDK>
    : RouterMethod<TServerContext, HTTPMethod, TRouterSDK>;
};

export type RouterBaseObject<
  TServerContext,
  TRouterSDK extends RouterSDK<string, TypedRequest, TypedResponse>,
> = RouterMethodsObj<TServerContext, TRouterSDK> & ServerAdapterBaseObject<TServerContext>;

export type Router<
  TServerContext,
  TRouterSDK extends RouterSDK<string, TypedRequest, TypedResponse>,
> = ServerAdapter<TServerContext, RouterBaseObject<TServerContext, TRouterSDK>> & {
  addRoute: AddRouteMethod<TServerContext, TRouterSDK>;
  sdk: TRouterSDK;
};

export type OnRouteHook<TServerContext> = (payload: OnRouteHookPayload<TServerContext>) => void;

export type OnRouteHookPayload<TServerContext> = {
  operationId?: string;
  description?: string;
  method: HTTPMethod;
  path: string;
  schemas?: RouteSchemas;
  handlers: RouterHandler<TServerContext>[];
};

export type OnRouterInitHook<TServerContext> = (router: Router<TServerContext, any>) => void;

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

export type RouterSDK<
  TPath extends string,
  TTypedRequest extends TypedRequest,
  TTypedResponse extends TypedResponse,
> = {
  [TPathKey in TPath]: {
    [TMethodKey in TTypedRequest['method']]: (opts?: {
      JSONBody?: TTypedRequest extends TypedRequest<infer TJSONBody, any, TMethodKey, any, any>
        ? TJSONBody
        : never;
      PathParams?: TTypedRequest extends TypedRequest<any, any, TMethodKey, any, infer TPathParams>
        ? TPathParams
        : never;
      QueryParams?: TTypedRequest extends TypedRequest<
        any,
        any,
        TMethodKey,
        infer TQueryParams,
        any
      >
        ? TQueryParams
        : never;
      Headers?: TTypedRequest extends TypedRequest<any, infer THeaders, TMethodKey, any, any>
        ? THeaders
        : never;
    }) => PromiseOrValue<TTypedResponse>;
  };
};

export type TypedRequestFromRouteSchemas<
  TRouteSchemas extends RouteSchemas,
  TMethod extends HTTPMethod,
> = TRouteSchemas extends { Request: Required<RouteSchemas>['Request'] }
  ? TypedRequest<
      TRouteSchemas['Request'] extends { JSONBody: JSONSchema }
        ? FromSchema<TRouteSchemas['Request']['JSONBody']>
        : any,
      TRouteSchemas['Request'] extends { Headers: JSONSchema }
        ? FromSchema<TRouteSchemas['Request']['Headers']> extends Record<string, string>
          ? FromSchema<TRouteSchemas['Request']['Headers']>
          : Record<string, string>
        : Record<string, string>,
      TMethod,
      TRouteSchemas['Request'] extends { QueryParams: JSONSchema }
        ? FromSchema<TRouteSchemas['Request']['QueryParams']> extends Record<string, string>
          ? FromSchema<TRouteSchemas['Request']['QueryParams']>
          : Record<string, string | string[]>
        : Record<string, string | string[]>,
      TRouteSchemas['Request'] extends { PathParams: JSONSchema }
        ? FromSchema<TRouteSchemas['Request']['PathParams']> extends Record<string, string>
          ? FromSchema<TRouteSchemas['Request']['PathParams']>
          : Record<string, any>
        : Record<string, any>
    >
  : TypedRequest;

export type TypedResponseFromRouteSchemas<TRouteSchemas extends RouteSchemas> =
  TRouteSchemas extends { Responses: Record<number, JSONSchema> }
    ? TypedResponseWithJSONStatusMap<{
        [TStatusCode in keyof TRouteSchemas['Responses']]: TRouteSchemas['Responses'][TStatusCode] extends JSONSchema
          ? FromSchema<TRouteSchemas['Responses'][TStatusCode]>
          : never;
      }>
    : TypedResponse;

export type AddRouteOpts<
  TServerContext,
  TRouteSchemas extends RouteSchemas,
  TMethod extends HTTPMethod,
  TPath extends string,
  TTypedRequest extends TypedRequestFromRouteSchemas<TRouteSchemas, TMethod>,
  TTypedResponse extends TypedResponseFromRouteSchemas<TRouteSchemas>,
> = {
  operationId?: string;
  description?: string;
  method: TMethod;
  path: TPath;
  schemas?: TRouteSchemas;
  handler: (request: TTypedRequest, ctx: TServerContext) => PromiseOrValue<TTypedResponse>;
};

export type AddRouteMethod<
  TServerContext,
  TRouterSDK extends RouterSDK<string, TypedRequest, TypedResponse>,
> = <
  TRouteSchemas extends RouteSchemas,
  TMethod extends HTTPMethod,
  TPath extends string,
  TTypedRequest extends TypedRequestFromRouteSchemas<TRouteSchemas, TMethod>,
  TTypedResponse extends TypedResponseFromRouteSchemas<TRouteSchemas>,
>(
  opts: AddRouteOpts<TServerContext, TRouteSchemas, TMethod, TPath, TTypedRequest, TTypedResponse>,
) => Router<TServerContext, TRouterSDK & RouterSDK<TPath, TTypedRequest, TTypedResponse>>;
