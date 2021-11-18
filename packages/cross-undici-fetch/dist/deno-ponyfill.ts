const fetch = globalThis.fetch;
const Request = globalThis.Request;
const Response = globalThis.Response;
const Headers = globalThis.Headers;
const FormData = globalThis.FormData;
const AbortController = globalThis.AbortController;
const ReadableStream = globalThis.ReadableStream;

export default fetch;
export {
  fetch,
  Headers,
  Request,
  Response,
  FormData,
  AbortController,
  ReadableStream,
};
