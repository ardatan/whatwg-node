/* eslint-disable camelcase */
import { FromSchema, JSONSchema7 } from 'json-schema-to-ts';
import { OpenAPIV3_1 } from 'openapi-types';
import { createGenericSDK, GenericSDKOptions, TypedResponse } from '@whatwg-node/typed-fetch';

export type Mutable<Type> = {
  -readonly [Key in keyof Type]: Mutable<Type[Key]>;
};

export type OASPathMap<TOAS extends OpenAPIV3_1.Document> = TOAS['paths'];
export type OASMethodMap<
  TOAS extends OpenAPIV3_1.Document,
  TPath extends keyof OASPathMap<TOAS>,
> = OASPathMap<TOAS>[TPath];
export type OASStatusMap<
  TOAS extends OpenAPIV3_1.Document,
  TPath extends keyof OASPathMap<TOAS>,
  TMethod extends keyof OASMethodMap<TOAS, TPath>,
> = OASMethodMap<TOAS, TPath>[TMethod] extends { responses: any }
  ? OASMethodMap<TOAS, TPath>[TMethod]['responses']
  : never;
export type OASJSONResponseSchema<
  TOAS extends OpenAPIV3_1.Document,
  TPath extends keyof OASPathMap<TOAS>,
  TMethod extends keyof OASMethodMap<TOAS, TPath>,
  TStatus extends keyof OASStatusMap<TOAS, TPath, TMethod>,
> = OASStatusMap<TOAS, TPath, TMethod>[TStatus]['content']['application/json']['schema'];

export type OASResponse<
  TOAS extends OpenAPIV3_1.Document,
  TPath extends keyof TOAS['paths'],
  TMethod extends keyof TOAS['paths'][TPath],
> = {
  [TStatus in keyof OASStatusMap<TOAS, TPath, TMethod>]: TypedResponse<
    FromSchema<OASJSONResponseSchema<TOAS, TPath, TMethod, TStatus> & TOAS>,
    Record<string, string>,
    TStatus extends number
      ? TStatus
      : TStatus extends 'default'
      ? number
      : TStatus extends string
      ? number
      : never
  >;
}[keyof OASStatusMap<TOAS, TPath, TMethod>];

export type OASParamMap<
  TParameters extends { name: string; schema: JSONSchema7 }[],
  TParamType extends string,
> = {
  [TIndex in keyof TParameters]: {
    [TName in TParameters[TIndex]['name']]: TParameters[TIndex] extends { in: TParamType }
      ? FromSchema<TParameters[TIndex]['schema']>
      : never;
  };
}[keyof TParameters];

export type OASClient<TOAS extends OpenAPIV3_1.Document> = {
  [TPath in keyof OASPathMap<TOAS>]: {
    [TMethod in keyof OASMethodMap<TOAS, TPath>]: (requestParams?: {
      JSONBody?: OASMethodMap<TOAS, TPath>[TMethod] extends {
        requestBody: { content: { 'application/json': { schema: JSONSchema7 } } };
      }
        ? FromSchema<
            OASMethodMap<
              TOAS,
              TPath
            >[TMethod]['requestBody']['content']['application/json']['schema']
          >
        : never;
      PathParams?: OASMethodMap<TOAS, TPath>[TMethod] extends {
        parameters: { name: string; schema: JSONSchema7 }[];
      }
        ? OASParamMap<OASMethodMap<TOAS, TPath>[TMethod]['parameters'], 'path'>
        : never;
      QueryParams?: OASMethodMap<TOAS, TPath>[TMethod] extends {
        parameters: { name: string; schema: JSONSchema7 }[];
      }
        ? OASParamMap<OASMethodMap<TOAS, TPath>[TMethod]['parameters'], 'query'>
        : never;
      Headers?: OASMethodMap<TOAS, TPath>[TMethod] extends {
        parameters: { name: string; schema: JSONSchema7 }[];
      }
        ? OASParamMap<OASMethodMap<TOAS, TPath>[TMethod]['parameters'], 'header'>
        : never;
    }) => Promise<OASResponse<TOAS, TPath, TMethod>>;
  };
};

export type OASClientOptions = GenericSDKOptions;

export function createOASClient<TOAS extends OpenAPIV3_1.Document>(
  opts?: OASClientOptions,
): OASClient<TOAS> {
  return createGenericSDK(opts);
}
