const fetch = globalThis.fetch;
const Request = globalThis.Request;
const Response = globalThis.Response;
const Headers = globalThis.Headers;
const FormData = globalThis.FormData;
const AbortController = globalThis.AbortController;
const ReadableStream = globalThis.ReadableStream;
const WritableStream = globalThis.WritableStream;
const TransformStream = globalThis.TransformStream;
const Blob = globalThis.Blob;
const File = globalThis.File;
const crypto = globalThis.crypto;
const TextDecoder = globalThis.TextDecoder;
const TextEncoder = globalThis.TextEncoder;
const Event = globalThis.Event;
const EventTarget = globalThis.EventTarget;

export const create = () => globalThis;
export {
  fetch,
  Headers,
  Request,
  Response,
  FormData,
  AbortController,
  ReadableStream,
  WritableStream,
  TransformStream,
  Blob,
  File,
  crypto,
  TextDecoder,
  TextEncoder,
  Event,
  EventTarget,
};
