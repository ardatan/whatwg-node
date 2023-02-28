export type TypedBody<TJSON, THeaders extends Record<string, string>> = Omit<
  Body,
  'json' | 'headers'
> & {
  json(): Promise<TJSON>;
  headers: TypedHeaders<THeaders>;
};

type DefaultHTTPHeaders =
  | 'accept'
  | 'accept-language'
  | 'content-language'
  | 'content-type'
  | 'content-length';

type Maybe = undefined | null;

export interface TypedHeaders<TMap extends Record<string, string>> {
  append<TName extends DefaultHTTPHeaders | keyof TMap>(
    name: TName,
    value: TName extends keyof TMap ? TMap[TName] : string,
  ): void;
  delete<TName extends DefaultHTTPHeaders | keyof TMap>(name: TName): void;
  get<TName extends DefaultHTTPHeaders | keyof TMap>(
    name: TName,
  ): TName extends keyof TMap
    ? TMap[TName]
    : TName extends DefaultHTTPHeaders
    ? string | null
    : never;
  has<TName extends DefaultHTTPHeaders | keyof TMap>(
    name: TName,
  ): TName extends DefaultHTTPHeaders
    ? boolean
    : TName extends keyof TMap
    ? TMap[TName] extends Maybe
      ? boolean
      : true
    : never;
  set<TName extends DefaultHTTPHeaders | keyof TMap>(
    name: TName,
    value: TName extends keyof TMap ? TMap[TName] : string,
  ): void;
  forEach(
    callbackfn: <TName extends keyof TMap>(
      value: TMap[TName],
      key: TName,
      parent: TypedHeaders<TMap>,
    ) => void,
    thisArg?: any,
  ): void;
}

export type TypedHeadersCtor = new <TMap extends Record<string, string>>(
  init?: TMap,
) => TypedHeaders<TMap>;

export type TypedResponseInit<TStatusCode extends number = 200> = Omit<ResponseInit, 'status'> & {
  status: TStatusCode;
};

export type TypedResponse<
  TJSON = any,
  THeaders extends Record<string, string> = Record<string, string>,
  TStatusCode extends number = 200,
> = Omit<Response, 'json' | 'status'> &
  TypedBody<TJSON, THeaders> & {
    status: TStatusCode;
  };

export type TypedResponseCtor = Omit<typeof Response, 'json'> & {
  new <TStatusCode extends number = 200>(
    body?: BodyInit | null | undefined,
    init?: TypedResponseInit<TStatusCode> | undefined,
  ): TypedResponse<any, Record<string, string>, TStatusCode>;
  json<TJSON, TStatusCode extends number>(
    value: TJSON,
    init?: TypedResponseInit<TStatusCode>,
  ): TypedResponse<TJSON, Record<string, string>, TStatusCode>;
};

export type TypedResponseWithJSONStatusMap<TResponseJSONStatusMap extends Record<number, any>> = {
  [TStatusCode in keyof TResponseJSONStatusMap]?: TStatusCode extends number
    ? TypedResponse<TResponseJSONStatusMap[TStatusCode], Record<string, string>, TStatusCode>
    : never;
}[keyof TResponseJSONStatusMap];

export type HTTPMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

export type TypedRequestInit<
  THeaders extends Record<string, string>,
  TMethod extends HTTPMethod,
> = Omit<RequestInit, 'method' | 'headers'> & {
  method: TMethod;
  headers: TypedHeaders<THeaders>;
};

export type TypedRequest<
  TJSON = any,
  THeaders extends Record<string, string> = Record<string, string>,
  TMethod extends HTTPMethod = HTTPMethod,
  TQueryParams extends Record<string, string | string[]> = Record<string, string | string[]>,
  TPathParams extends Record<string, any> = Record<string, any>,
> = Omit<Request, 'json' | 'method' | 'headers'> &
  TypedBody<TJSON, THeaders> & {
    method: TMethod;
    parsedUrl: TypedURL<TQueryParams>;
    params: TPathParams;
    query: TQueryParams;
  };

export type TypedRequestCtor = new <
  THeaders extends Record<string, string>,
  TMethod extends HTTPMethod,
  TQueryParams extends Record<string, string | string[]>,
>(
  input: string | TypedURL<TQueryParams>,
  init?: TypedRequestInit<THeaders, TMethod>,
) => TypedRequest<any, THeaders, TMethod, TQueryParams, any>;

export interface TypedURLSearchParams<TMap extends Record<string, string | string[]>> {
  append<TName extends keyof TMap>(
    name: TName,
    value: TMap[TName] extends any[] ? TMap[TName][1] : TMap[TName],
  ): void;
  delete(name: keyof TMap): void;
  get<TName extends keyof TMap>(
    name: TName,
  ): TMap[TName] extends any[] ? TMap[TName][1] : TMap[TName];
  getAll<TName extends keyof TMap>(
    name: TName,
  ): TMap[TName] extends any[] ? TMap[TName] : [TMap[TName]];
  set<TName extends keyof TMap>(
    name: TName,
    value: TMap[TName] extends any[] ? TMap[TName][1] : TMap[TName],
  ): void;
  sort(): void;
  toString(): string;
  forEach(
    callbackfn: <TName extends keyof TMap>(
      value: TMap[TName] extends any[] ? TMap[TName][1] : TMap[TName],
      name: TName,
      parent: TypedURLSearchParams<TMap>,
    ) => void,
    thisArg?: any,
  ): void;
}

export type TypedURLSearchParamsCtor = new <TMap extends Record<string, string | string[]>>(
  init?: TMap,
) => TypedURLSearchParams<TMap>;

export type TypedURL<TQueryParams extends Record<string, string | string[]>> = Omit<
  URL,
  'searchParams'
> & {
  searchParams: TypedURLSearchParams<TQueryParams>;
};

export type TypedURLCtor = new <TQueryParams extends Record<string, string | string[]>>(
  input: string,
  base?: string | TypedURL<any>,
) => TypedURL<TQueryParams>;
