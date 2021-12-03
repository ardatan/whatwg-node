const fetch = globalThis.fetch;
const Request = globalThis.Request;
const Response = globalThis.Response;
const Headers = globalThis.Headers;
const FormData = globalThis.FormData;
const AbortController = globalThis.AbortController;
const ReadableStream = globalThis.ReadableStream;
const Blob = globalThis.Blob;
const File = globalThis.File;

export default fetch;
export {
  fetch,
  Headers,
  Request,
  Response,
  FormData,
  AbortController,
  ReadableStream,
  Blob,
  File,
};
