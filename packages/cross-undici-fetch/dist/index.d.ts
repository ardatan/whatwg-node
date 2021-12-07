/// <reference lib="dom" />

declare const _fetch: typeof fetch;
declare const _Request: typeof Request;
declare const _Response: typeof Response;
declare const _Headers: typeof Headers;
declare const _FormData: typeof FormData;
declare const _AbortController: typeof AbortController;
declare const _ReadableStream: typeof ReadableStream;
declare const _Blob = Blob;
declare const _File = File;

declare module "cross-undici-fetch" {
  export const fetch: typeof _fetch;
  export const Request: typeof _Request;
  export const Response: typeof _Response;
  export const Headers: typeof _Headers;
  export const FormData: typeof _FormData;
  export const AbortController: typeof _AbortController;
  export const ReadableStream: typeof _ReadableStream;
  export const Blob: typeof _Blob;
  export const File: typeof _File;
  export default fetch;
}
