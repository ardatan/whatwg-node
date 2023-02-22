export type TypedBody<TJSON, THeaders extends Record<string, string>> = Omit<Body, 'json' | 'headers'> & {
  json(): Promise<TJSON>;
  headers: TypedHeaders<THeaders>;
};

export type TypedHeaders<TMap extends Record<string, string>> = {
  append<TName extends keyof TMap & string>(name: TName, value: TMap[TName]): void;
  delete<TName extends keyof TMap & string>(name: TName): void;
  get<TName extends string>(name: TName): TName extends keyof TMap ? TMap[TName] : string | null;
  has<TName extends string>(name: TName): TMap extends Record<TName, any> ? true : boolean;
  set<TName extends keyof TMap & string>(name: TName, value: TMap[TName]): void;
  forEach(
    callbackfn: <TName extends keyof TMap & string>(
      value: TMap[TName],
      key: TName,
      parent: TypedHeaders<TMap>,
    ) => void,
    thisArg?: any,
  ): void;
};

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
> = Omit<
  Response,
  'json' | 'status'
> &
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
  TMethod extends HTTPMethod
> =
  Omit<RequestInit, 'method' | 'headers'> & {
    method: TMethod;
    headers: TypedHeaders<THeaders>;
  };

export type TypedRequest<
  TJSON = any,
  THeaders extends Record<string, string> = Record<string, string>,
  TMethod extends HTTPMethod = HTTPMethod,
  TQueryParams extends Record<string, string | string[]> = Record<string, string | string[]>,
  TPathParams extends Record<string, any> = Record<string, any>
> = Omit<Request, 'json' | 'method' | 'headers'> &
  TypedBody<TJSON, THeaders> & {
    method: TMethod,
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

export type TypedURLSearchParams<TMap extends Record<string, string | string[]>> = {
  append<TName extends keyof TMap & string>(
    name: TName,
    value: TMap[TName] extends any[] ? TMap[TName][1] : TMap[TName],
  ): void;
  delete(name: keyof TMap & string): void;
  get<TName extends keyof TMap & string>(
    name: TName,
  ): TMap[TName] extends any[] ? TMap[TName][1] : TMap[TName];
  set<TName extends keyof TMap & string>(
    name: TName,
    value: TMap[TName] extends any[] ? TMap[TName][1] : TMap[TName],
  ): void;
  sort(): void;
  toString(): string;
  forEach(
    callbackfn: <TName extends keyof TMap & string>(
      value: TMap[TName] extends any[] ? TMap[TName][1] : TMap[TName],
      name: TName,
      parent: TypedURLSearchParams<TMap>,
    ) => void,
    thisArg?: any,
  ): void;
};

export type TypedURLSearchParamsCtor = new <TMap extends Record<string, string | string[]>>(
  init?: TMap,
) => TypedURLSearchParams<TMap>;

export type TypedURL<TQueryParams extends Record<string, string | string[]>> = Omit<URL, 'searchParams'> & {
  searchParams: TypedURLSearchParams<TQueryParams>;
};

export type TypedURLCtor = new <TQueryParams extends Record<string, string | string[]>>(
  input: string,
  base?: string | TypedURL<any>,
) => TypedURL<TQueryParams>;
