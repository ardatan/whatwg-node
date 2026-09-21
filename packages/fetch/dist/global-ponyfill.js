module.exports.fetch = globalThis.fetch;
module.exports.Headers = globalThis.Headers;
module.exports.Request = globalThis.Request;
module.exports.Response = globalThis.Response;
module.exports.FormData = globalThis.FormData;
module.exports.ReadableStream = globalThis.ReadableStream;
module.exports.WritableStream = globalThis.WritableStream;
module.exports.TransformStream = globalThis.TransformStream;
module.exports.CompressionStream = globalThis.CompressionStream;
module.exports.DecompressionStream = globalThis.DecompressionStream;
module.exports.TextDecoderStream = globalThis.TextDecoderStream;
module.exports.TextEncoderStream = globalThis.TextEncoderStream;
module.exports.Blob = globalThis.Blob;
module.exports.File = globalThis.File;
module.exports.btoa = globalThis.btoa;
module.exports.TextEncoder = globalThis.TextEncoder;
module.exports.TextDecoder = globalThis.TextDecoder;
module.exports.URLPattern = globalThis.URLPattern;
module.exports.URL = globalThis.URL;
module.exports.URLSearchParams = globalThis.URLSearchParams;
module.exports.createFetch = () => ({
  fetch: globalThis.fetch,
  Headers: globalThis.Headers,
  Request: globalThis.Request,
  Response: globalThis.Response,
  FormData: globalThis.FormData,
  ReadableStream: globalThis.ReadableStream,
  WritableStream: globalThis.WritableStream,
  TransformStream: globalThis.TransformStream,
  CompressionStream: globalThis.CompressionStream,
  DecompressionStream: globalThis.DecompressionStream,
  TextDecoderStream: globalThis.TextDecoderStream,
  TextEncoderStream: globalThis.TextEncoderStream,
  Blob: globalThis.Blob,
  File: globalThis.File,
  btoa: globalThis.btoa,
  TextEncoder: globalThis.TextEncoder,
  TextDecoder: globalThis.TextDecoder,
  URLPattern: globalThis.URLPattern,
  URL: globalThis.URL,
  URLSearchParams: globalThis.URLSearchParams,
});
