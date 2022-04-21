/// <reference lib="dom" />

declare const _fetch: typeof fetch;
declare const _Request: typeof Request;
declare const _Response: typeof Response;
declare const _Headers: typeof Headers;
declare const _FormData: typeof FormData;
declare const _AbortController: typeof AbortController;
declare const _ReadableStream: typeof ReadableStream;
declare const _WritableStream: typeof WritableStream;
declare const _TransformStream: typeof TransformStream;
declare const _Blob: typeof Blob;
declare const _File: typeof File;
declare const _crypto: typeof crypto;

declare module "cross-undici-fetch" {
  export const fetch: typeof _fetch;
  export const Request: typeof _Request;
  export const Response: typeof _Response;
  export const Headers: typeof _Headers;
  export const FormData: typeof _FormData;
  export const AbortController: typeof _AbortController;
  export const ReadableStream: typeof _ReadableStream;
  export const WritableStream: typeof _WritableStream;
  export const TransformStream: typeof _TransformStream;
  export const Blob: typeof _Blob;
  export const File: typeof _File;
  export const crypto: typeof _crypto;
  export const create: (opts?: { useNodeFetch?: boolean }) => ({
    fetch: typeof _fetch,
    Request: typeof _Request,
    Response: typeof _Response,
    Headers: typeof _Headers,
    FormData: typeof _FormData,
    AbortController: typeof _AbortController,
    ReadableStream: typeof _ReadableStream,
    WritableStream: typeof _WritableStream,
    TransformStream: typeof _TransformStream,
    Blob: typeof _Blob,
    File: typeof _File,
    crypto: typeof _crypto
  });
}

