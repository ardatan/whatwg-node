export type TypedBodyOpts<TJSON, THeaders extends Record<string, string>> = {
  JSON?: TJSON;
  Headers?: THeaders;
};

export type TypedBody<TOpts extends TypedBodyOpts<any, any>> = Omit<Body, 'json' | 'headers'> & {
  headers: TypedHeaders<TOpts['Headers']>;
  json(): Promise<TOpts['JSON']>;
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

export type TypedResponseOpts<
  TTypedBodyOpts extends TypedBodyOpts<any, any>,
  TStatusCode extends number = 200,
> = TTypedBodyOpts & {
  StatusCode: TStatusCode;
};

export type TypedResponseInit<TStatusCode extends number = 200> = Omit<ResponseInit, 'status'> & {
  status: TStatusCode;
};

export type TypedResponse<TOpts extends TypedResponseOpts<TypedBodyOpts<any, any>, number>> = Omit<
  Response,
  'json' | 'status'
> &
  TypedBody<TOpts> & {
    status: TOpts['StatusCode'];
  };

export type TypedResponseCtor = Omit<typeof Response, 'json'> & {
  new <TStatusCode extends number = 200>(
    body?: BodyInit | null | undefined,
    init?: TypedResponseInit<TStatusCode> | undefined,
  ): TypedResponse<{
    StatusCode: TStatusCode;
  }>;
  json<TJSON, TStatusCode extends number>(
    value: TJSON,
    init?: TypedResponseInit<TStatusCode>,
  ): TypedResponse<{
    JSON: TJSON;
    StatusCode: TStatusCode;
  }>;
};

export type TypedResponseWithJSONStatusMap<TResponseJSONStatusMap extends Record<number, any>> = {
  [TStatusCode in keyof TResponseJSONStatusMap]?: TStatusCode extends number
    ? TypedResponse<{
        JSON: TResponseJSONStatusMap[TStatusCode];
        StatusCode: TStatusCode;
      }>
    : never;
}[keyof TResponseJSONStatusMap];

export type HTTPMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

export type TypedRequestOpts<
  TTypedBodyOpts extends TypedBodyOpts<any, any>,
  TURLOpts extends TypedURLOpts<any, any>,
  TMethod extends HTTPMethod = 'get',
> = TTypedBodyOpts &
  TURLOpts & {
    Method?: TMethod;
  };

export type TypedRequestInit<TOpts extends TypedBodyOpts<any, any> & { Method?: HTTPMethod }> =
  Omit<RequestInit, 'method' | 'headers'> & {
    method: TOpts['Method'];
    headers: TypedHeaders<TOpts['Headers']>;
  };

export type TypedRequest<
  TOpts extends TypedRequestOpts<TypedBodyOpts<any, any>, TypedURLOpts<any, any>, HTTPMethod>,
> = Omit<Request, 'json' | 'method' | 'headers'> &
  TypedBody<TOpts> & {
    method: TOpts['Method'];
    parsedUrl: TypedURL<TOpts>;
    params: TOpts['PathParams'];
    query: TOpts['QueryParams'];
  };

export type TypedRequestCtor = new <
  TOpts extends TypedRequestOpts<TypedBodyOpts<any, any>, TypedURLOpts<any, any>, HTTPMethod>,
>(
  input: string | TypedURL<TOpts>,
  init?: TypedRequestInit<TOpts>,
) => TypedRequest<TOpts>;

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

export type TypedURLOpts<
  TQueryParams extends Record<string, string | string>,
  TPathParams extends Record<string, any>,
> = {
  QueryParams?: TQueryParams;
  PathParams?: TPathParams;
};

export type TypedURL<TOpts extends TypedURLOpts<any, any>> = Omit<URL, 'searchParams'> & {
  searchParams: TypedURLSearchParams<TOpts['QueryParams']>;
};

export type TypedURLCtor = new <TOpts extends TypedURLOpts<any, any>>(
  input: string,
  base?: string | TypedURL<TOpts>,
) => TypedURL<TOpts>;
