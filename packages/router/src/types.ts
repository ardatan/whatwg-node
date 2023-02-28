import { FromSchema, JSONSchema as JSONSchemaOrBoolean } from 'json-schema-to-ts';
import { ServerAdapter, ServerAdapterBaseObject, ServerAdapterPlugin } from '@whatwg-node/server';
import type {
  HTTPMethod,
  TypedRequest,
  TypedResponse,
  TypedResponseWithJSONStatusMap,
} from '@whatwg-node/typed-fetch';

type JSONSchema = Exclude<JSONSchemaOrBoolean, boolean>;

type PromiseOrValue<T> = T | Promise<T>;

export type TypedRouterHandlerTypeConfig<
  TRequestJSON = any,
  TRequestHeaders extends Record<string, string> = Record<string, string>,
  TRequestQueryParams extends Record<string, string | string[]> = Record<string, string | string[]>,
  TRequestPathParams extends Record<string, any> = Record<string, any>,
  TResponseJSONStatusMap extends Record<number, any> = Record<number, any>,
> = {
  request: {
    json?: TRequestJSON;
    headers?: TRequestHeaders;
    query?: TRequestQueryParams;
    params?: TRequestPathParams;
  };
  responses: TResponseJSONStatusMap;
};

export type TypedRequestFromTypeConfig<
  TMethod extends HTTPMethod,
  TTypeConfig extends TypedRouterHandlerTypeConfig,
> = TTypeConfig extends TypedRouterHandlerTypeConfig<
  infer TRequestJSON,
  infer TRequestHeaders,
  infer TRequestQueryParams,
  infer TRequestPathParams
>
  ? TypedRequest<TRequestJSON, TRequestHeaders, TMethod, TRequestQueryParams, TRequestPathParams>
  : TypedRequest<any, Record<string, string>, TMethod>;

export type TypedResponseFromTypeConfig<TTypeConfig extends TypedRouterHandlerTypeConfig> =
  TTypeConfig extends {
    responses: infer TResponses;
  }
    ? TResponses extends Record<number, any>
      ? TypedResponseWithJSONStatusMap<TResponses>
      : TypedResponse
    : TypedResponse;

export type RouterMethod<
  TServerContext,
  TMethod extends HTTPMethod,
  TRouterSDK extends RouterSDK<string, TypedRequest, TypedResponse>,
> = <
  TTypeConfig extends TypedRouterHandlerTypeConfig,
  TTypedRequest extends TypedRequestFromTypeConfig<
    TMethod,
    TTypeConfig
  > = TypedRequestFromTypeConfig<TMethod, TTypeConfig>,
  TTypedResponse extends TypedResponseFromTypeConfig<TTypeConfig> = TypedResponseFromTypeConfig<TTypeConfig>,
  TPath extends string = string,
>(
  path: TPath,
  ...handlers: RouterHandler<TServerContext, TTypedRequest, TTypedResponse>[]
) => Router<TServerContext, TRouterSDK & RouterSDK<TPath, TTypedRequest, TTypedResponse>>;

export type RouteMethodKey = HTTPMethod | 'all' | 'use';

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
  addRoute<
    TRouteSchemas extends RouteSchemas,
    TMethod extends HTTPMethod,
    TPath extends string,
    TTypedRequest extends TypedRequestFromRouteSchemas<TRouteSchemas, TMethod>,
    TTypedResponse extends TypedResponseFromRouteSchemas<TRouteSchemas>,
  >(
    opts: AddRouteWithSchemasOpts<
      TServerContext,
      TRouteSchemas,
      TMethod,
      TPath,
      TTypedRequest,
      TTypedResponse
    >,
  ): Router<TServerContext, TRouterSDK & RouterSDK<TPath, TTypedRequest, TTypedResponse>>;
  addRoute<
    TTypeConfig extends TypedRouterHandlerTypeConfig,
    TMethod extends HTTPMethod = HTTPMethod,
    TTypedRequest extends TypedRequestFromTypeConfig<
      TMethod,
      TTypeConfig
    > = TypedRequestFromTypeConfig<TMethod, TTypeConfig>,
    TTypedResponse extends TypedResponseFromTypeConfig<TTypeConfig> = TypedResponseFromTypeConfig<TTypeConfig>,
    TPath extends string = string,
  >(
    opts: AddRouteWithTypesOpts<TServerContext, TTypedRequest, TTypedResponse, TMethod, TPath>,
  ): Router<TServerContext, TRouterSDK & RouterSDK<TPath, TTypedRequest, TTypedResponse>>;
  __sdk: TRouterSDK;
};

export type OnRouteHook<TServerContext> = (payload: OnRouteHookPayload<TServerContext>) => void;

export type RouterHandler<
  TServerContext,
  TTypedRequest extends TypedRequest = TypedRequest,
  TTypedResponse extends TypedResponse = TypedResponse,
> = (request: TTypedRequest, context: TServerContext) => PromiseOrValue<TTypedResponse | void>;

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
  request?: {
    headers?: JSONSchema;
    params?: JSONSchema;
    query?: JSONSchema;
    json?: JSONSchema;
  };
  responses?: Record<number, JSONSchema>;
};

export type RouterSDKOpts<
  TTypedRequest extends TypedRequest = TypedRequest,
  TMethod extends HTTPMethod = HTTPMethod,
> = {
  json?: TTypedRequest extends TypedRequest<infer TJSONBody, any, TMethod, any, any>
    ? TJSONBody
    : never;
  params?: TTypedRequest extends TypedRequest<any, any, TMethod, any, infer TPathParams>
    ? TPathParams
    : never;
  query?: TTypedRequest extends TypedRequest<any, any, TMethod, infer TQueryParams, any>
    ? TQueryParams
    : never;
  headers?: TTypedRequest extends TypedRequest<any, infer THeaders, TMethod, any, any>
    ? THeaders
    : never;
};

export type RouterSDK<
  TPath extends string = string,
  TTypedRequest extends TypedRequest = TypedRequest,
  TTypedResponse extends TypedResponse = TypedResponse,
> = {
  [TPathKey in TPath]: {
    [TMethod in TTypedRequest['method']]: (
      opts?: RouterSDKOpts<TTypedRequest, TMethod>,
    ) => PromiseOrValue<TTypedResponse>;
  };
};

export type TypedRequestFromRouteSchemas<
  TRouteSchemas extends RouteSchemas,
  TMethod extends HTTPMethod,
> = TRouteSchemas extends { request: Required<RouteSchemas>['request'] }
  ? TypedRequest<
      TRouteSchemas['request'] extends { json: JSONSchema }
        ? FromSchema<TRouteSchemas['request']['json']>
        : any,
      TRouteSchemas['request'] extends { headers: JSONSchema }
        ? FromSchema<TRouteSchemas['request']['headers']> extends Record<string, string>
          ? FromSchema<TRouteSchemas['request']['headers']>
          : Record<string, string>
        : Record<string, string>,
      TMethod,
      TRouteSchemas['request'] extends { query: JSONSchema }
        ? FromSchema<TRouteSchemas['request']['query']> extends Record<string, string>
          ? FromSchema<TRouteSchemas['request']['query']>
          : Record<string, string | string[]>
        : Record<string, string | string[]>,
      TRouteSchemas['request'] extends { params: JSONSchema }
        ? FromSchema<TRouteSchemas['request']['params']> extends Record<string, string>
          ? FromSchema<TRouteSchemas['request']['params']>
          : Record<string, any>
        : Record<string, any>
    >
  : TypedRequest;

export type TypedResponseFromRouteSchemas<TRouteSchemas extends RouteSchemas> =
  TRouteSchemas extends { responses: Record<number, JSONSchema> }
    ? TypedResponseWithJSONStatusMap<{
        [TStatusCode in keyof TRouteSchemas['responses']]: TRouteSchemas['responses'][TStatusCode] extends JSONSchema
          ? FromSchema<TRouteSchemas['responses'][TStatusCode]>
          : never;
      }>
    : TypedResponse;

export type AddRouteWithSchemasOpts<
  TServerContext,
  TRouteSchemas extends RouteSchemas,
  TMethod extends HTTPMethod,
  TPath extends string,
  TTypedRequest extends TypedRequestFromRouteSchemas<TRouteSchemas, TMethod>,
  TTypedResponse extends TypedResponseFromRouteSchemas<TRouteSchemas>,
> = {
  operationId?: string;
  description?: string;
  schemas: TRouteSchemas;
} & AddRouteWithTypesOpts<TServerContext, TTypedRequest, TTypedResponse, TMethod, TPath>;

export type AddRouteWithTypesOpts<
  TServerContext,
  TTypedRequest extends TypedRequest,
  TTypedResponse extends TypedResponse,
  TMethod extends HTTPMethod,
  TPath extends string,
> = {
  method: TMethod | Uppercase<TMethod>;
  path: TPath;
  handler: (request: TTypedRequest, ctx: TServerContext) => PromiseOrValue<TTypedResponse>;
};

type ResolvedPromise<T> = T extends Promise<infer U> ? U : T;

export type RouterInput<
  TRouter extends Router<any, RouterSDK>,
  TRouterSDK extends RouterSDK = TRouter['__sdk'],
> = {
  [TPathKey in keyof TRouterSDK]: {
    [TMethodKey in keyof TRouterSDK[TPathKey]]: TMethodKey extends HTTPMethod
      ? Required<Exclude<Parameters<TRouterSDK[TPathKey][TMethodKey]>[0], undefined>>
      : never;
  };
};

type ResponseByPathAndMethod<
  TRouterSDK extends RouterSDK,
  TPath extends keyof TRouterSDK,
  TMethod extends keyof TRouterSDK[TPath],
> = TMethod extends HTTPMethod ? ResolvedPromise<ReturnType<TRouterSDK[TPath][TMethod]>> : never;

export type RouterOutput<
  TRouter extends Router<any, RouterSDK>,
  TRouterSDK extends RouterSDK = TRouter['__sdk'],
> = {
  [TPathKey in keyof TRouterSDK]: {
    [TMethodKey in keyof TRouterSDK[TPathKey]]: TMethodKey extends HTTPMethod
      ? ResponseByPathAndMethod<TRouterSDK, TPathKey, TMethodKey> extends {
          status: infer TStatusCode;
          json(): Promise<infer TJSON>;
        }
        ? {
            [TStatusCodeKey in TStatusCode extends number ? TStatusCode : never]: TJSON;
          }
        : never
      : never;
  };
};
