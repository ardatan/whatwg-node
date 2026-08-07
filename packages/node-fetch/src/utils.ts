import { once } from 'node:events';
import { Readable, Writable } from 'node:stream';
import zlib from 'node:zlib';
import { PonyfillCompressionFormat } from './CompressionStream';

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

export function pipeThrough({
  src,
  dest,
  signal,
  onError,
}: {
  src: Readable;
  dest: Writable;
  signal?: AbortSignal | undefined;
  onError?: ((e: Error) => void) | undefined;
}) {
  if (onError) {
    // listen for errors on the destination stream if necessary. if the readable
    // stream (src) emits an error, the writable destination (dest) will be
    // destroyed with that error (see below)
    dest.once('error', onError);
  }

  src.once('error', (e: Error) => {
    // if the readable stream (src) emits an error during pipe, the writable
    // destination (dest) is not closed automatically. that needs to be
    // done manually. the readable stream is closed when error is emitted,
    // so only the writable destination needs to be destroyed
    dest.destroy(e);
  });

  dest.once('close', () => {
    // if the writable destination (dest) is closed, the readable stream (src)
    // is not closed automatically. that needs to be done manually
    if (!src.destroyed) {
      src.destroy();
    }
  });

  if (signal) {
    // this is faster than `import('node:signal').addAbortSignal(signal, src)`
    const srcRef = new WeakRef(src);
    const signalRef = new WeakRef(signal);
    function cleanup() {
      signalRef.deref()?.removeEventListener('abort', onAbort);
      srcRef.deref()?.removeListener('end', cleanup);
      srcRef.deref()?.removeListener('error', cleanup);
      srcRef.deref()?.removeListener('close', cleanup);
    }
    function onAbort() {
      srcRef.deref()?.destroy(new AbortError());
      cleanup();
    }
    signal.addEventListener('abort', onAbort, { once: true });
    // this is faster than `import('node:signal').finished(src, cleanup)`
    src.once('end', cleanup);
    src.once('error', cleanup);
    src.once('close', cleanup);
  }

  src.pipe(dest, { end: true /* already default */ });
}

export function endStream(stream: { end: (...args: any[]) => void }) {
  // Avoid arguments adaptor trampoline https://v8.dev/blog/adaptor-frame
  return stream.end(null, null, null);
}

export function safeWrite<TWritable extends Writable>(
  chunk: Parameters<TWritable['write']>[0],
  stream: TWritable,
) {
  const result = stream.write(chunk);
  if (!result) {
    return once(stream, 'drain');
  }
}

// https://github.com/nodejs/node/blob/f692878dec6354c0a82241f224906981861bc840/lib/internal/errors.js#L961-L973
class AbortError extends Error {
  constructor(message = 'The operation was aborted', options = undefined) {
    super(message, options);
    this.name = 'AbortError';
  }
}

export const DEFAULT_ACCEPT_ENCODING = getSupportedFormats().join(', ');

export function getSupportedFormats(): PonyfillCompressionFormat[] {
  const baseFormats = ['gzip', 'deflate', 'br'] as PonyfillCompressionFormat[];
  if (!globalThis.process?.versions?.node?.startsWith('2')) {
    baseFormats.push('deflate-raw');
  }
  if (zlib.createZstdCompress != null) {
    baseFormats.push('zstd');
  }
  return baseFormats;
}
