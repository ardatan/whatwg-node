import { Readable } from 'node:stream';

function isHeadersInstance(obj: any): obj is Headers {
  return obj?.forEach != null;
}

export function getHeadersObj(headers: Headers): Record<string, string> {
  if (headers == null || !isHeadersInstance(headers)) {
    return headers as any;
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
