import { once } from 'node:events';
import { IncomingMessage } from 'node:http';
import { PassThrough, Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

function isHeadersInstance(obj: any): obj is Headers {
  return obj?.forEach != null;
}

export function getHeadersObj(headers: Headers): Record<string, string> {
  if (headers == null || !isHeadersInstance(headers)) {
    return headers as any;
  }
  // @ts-expect-error - `headersInit` is not a public property
  if (headers.headersInit && !headers._map && !isHeadersInstance(headers.headersInit)) {
    // @ts-expect-error - `headersInit` is not a public property
    return headers.headersInit;
  }
  return Object.fromEntries(headers.entries());
}

export function defaultHeadersSerializer(
  headers: Headers,
  onContentLength?: (value: string) => void,
): string[] {
  const headerArray: string[] = [];
  headers.forEach((value, key) => {
    if (onContentLength && key === 'content-length') {
      onContentLength(value);
    }
    headerArray.push(`${key}: ${value}`);
  });
  return headerArray;
}

export { fakePromise } from '@whatwg-node/promise-helpers';

export function isArrayBufferView(obj: any): obj is ArrayBufferView {
  return obj != null && obj.buffer != null && obj.byteLength != null && obj.byteOffset != null;
}

export function isNodeReadable(obj: any): obj is Readable {
  return obj != null && obj.pipe != null;
}

export function isIterable(value: any): value is Iterable<unknown> {
  return value?.[Symbol.iterator] != null;
}

export function shouldRedirect(status?: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

export function wrapIncomingMessageWithPassthrough({
  incomingMessage,
  signal,
  passThrough = new PassThrough(),
  onError = (e: Error) => {
    passThrough.destroy(e);
  },
}: {
  incomingMessage: IncomingMessage;
  passThrough?: PassThrough | undefined;
  signal?: AbortSignal | undefined;
  onError?: (e: Error) => void;
}) {
  pipeline(incomingMessage, passThrough, {
    signal,
    end: true,
  })
    .then(() => {
      if (!incomingMessage.destroyed) {
        incomingMessage.resume();
      }
    })
    .catch(onError);
  return passThrough;
}

export function endStream(stream: { end: () => void }) {
  // @ts-expect-error Avoid arguments adaptor trampoline https://v8.dev/blog/adaptor-frame
  return stream.end(null, null, null);
}

export function safeWrite(chunk: any, stream: Writable, signal?: AbortSignal | undefined) {
  const result = stream.write(chunk);
  if (!result) {
    return once(stream, 'drain', {
      signal,
    }) as unknown as Promise<any>;
  }
}

export function isArray<T>(value: any): value is T[] {
  return value?.length != null && value?.map && value?.slice && value?.splice;
}
