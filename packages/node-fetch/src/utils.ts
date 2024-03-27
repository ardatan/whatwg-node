import { Readable } from 'stream';

function isHeadersInstance(obj: any): obj is Headers {
  return obj?.forEach != null;
}

export function patchReadableFromWeb() {
  try {
    const originalReadableFromWeb = Readable.fromWeb;

    if (originalReadableFromWeb.name !== 'ReadableFromWebPatchedByWhatWgNode') {
      Readable.fromWeb = function ReadableFromWebPatchedByWhatWgNode(stream: any): Readable {
        if (stream.readable != null) {
          return stream.readable;
        }
        return originalReadableFromWeb(stream as any);
      };
    }
  } catch (e) {
    console.warn(
      'Could not patch Readable.fromWeb, so this might break Readable.fromWeb usage with the whatwg-node and the integrations like Fastify',
      e,
    );
  }
}

export function getHeadersObj(headers: Headers): Record<string, string> {
  if (headers == null || !isHeadersInstance(headers)) {
    return headers as any;
  }
  const obj: Record<string, string> = {};
  headers.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
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

function isPromise<T>(val: T | Promise<T>): val is Promise<T> {
  return (val as any)?.then != null;
}

export function fakePromise<T>(value: T): Promise<T> {
  if (isPromise(value)) {
    return value;
  }
  // Write a fake promise to avoid the promise constructor
  // being called with `new Promise` in the browser.
  return {
    then(resolve: (value: T) => any) {
      if (resolve) {
        const callbackResult = resolve(value);
        if (isPromise(callbackResult)) {
          return callbackResult;
        }
        return fakePromise(callbackResult);
      }
      return this;
    },
    catch() {
      return this;
    },
    finally(cb) {
      if (cb) {
        const callbackResult = cb();
        if (isPromise(callbackResult)) {
          return callbackResult.then(() => value);
        }
        return fakePromise(value);
      }
      return this;
    },
    [Symbol.toStringTag]: 'Promise',
  };
}

export function isArrayBufferView(obj: any): obj is ArrayBufferView {
  return obj != null && obj.buffer != null && obj.byteLength != null && obj.byteOffset != null;
}

export function isNodeReadable(obj: any): obj is Readable {
  return obj != null && obj.pipe != null;
}
