import { once } from 'node:events';
import { Writable } from 'node:stream';
import { fakePromise, fakeRejectPromise } from '@whatwg-node/promise-helpers';
import { endStream, safeWrite } from './utils.js';

/**
 * Create a Node.js Writable from a WHATWG UnderlyingSink.
 * Used lazily – only when callers access `.writable` directly.
 */
function createWritableFromSink<W>(sink: UnderlyingSink<W>): Writable {
  const abortCtrl = new AbortController();
  const writable = new Writable({
    write(chunk: W, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
      try {
        const result = sink.write?.(chunk, controller);
        if (result instanceof Promise) {
          result.then(
            () => {
              callback();
            },
            err => {
              callback(err);
            },
          );
        } else {
          callback();
        }
      } catch (err) {
        callback(err as Error);
      }
    },
    final(callback: (error?: Error | null) => void) {
      const result = sink.close?.();
      if (result instanceof Promise) {
        result.then(
          () => {
            callback();
          },
          err => {
            callback(err);
          },
        );
      } else {
        callback();
      }
    },
  });
  const controller: WritableStreamDefaultController = {
    signal: abortCtrl.signal,
    error(e) {
      writable.destroy(e);
    },
  };
  writable.once('error', err => abortCtrl.abort(err));
  writable.once('close', () => abortCtrl.abort());
  return writable;
}

/**
 * Create a WritableStreamDefaultWriter that calls sink methods directly,
 * bypassing Node.js Writable overhead entirely.
 */
function createWriterFromSink<W>(sink: UnderlyingSink<W>): WritableStreamDefaultWriter<W> {
  const abortCtrl = new AbortController();
  const controller: WritableStreamDefaultController = {
    signal: abortCtrl.signal,
    error(e) {
      abortCtrl.abort(e);
    },
  };

  // Call start synchronously if provided
  sink.start?.(controller);

  let closed = false;
  let aborted = false;

  return {
    get closed() {
      return new Promise<undefined>(resolve => {
        if (closed) resolve(undefined);
      }) as Promise<undefined>;
    },
    get desiredSize() {
      return 1;
    },
    get ready() {
      return fakePromise() as Promise<undefined>;
    },
    releaseLock() {
      // no-op
    },
    write(chunk: W) {
      if (chunk == null) return fakePromise();
      try {
        const result = sink.write?.(chunk, controller);
        if (result instanceof Promise) return result as Promise<void>;
        return fakePromise();
      } catch (err) {
        return Promise.reject(err);
      }
    },
    close() {
      if (aborted) return fakeRejectPromise(new Error('Aborted'));
      closed = true;
      try {
        const result = sink.close?.();
        if (result instanceof Promise) return result as Promise<void>;
        return fakePromise();
      } catch (err) {
        return Promise.reject(err);
      }
    },
    abort(reason?: any) {
      aborted = true;
      closed = true;
      abortCtrl.abort(reason);
      if (sink.abort) {
        const result = sink.abort(reason);
        if (result instanceof Promise) return result as Promise<void>;
      }
      return fakePromise();
    },
  };
}

/**
 * Create a WritableStreamDefaultWriter backed by a Node.js Writable.
 */
function createWriterFromWritable<W>(writable: Writable): WritableStreamDefaultWriter<W> {
  return {
    get closed() {
      return once(writable, 'close') as Promise<any>;
    },
    get desiredSize() {
      return writable.writableLength;
    },
    get ready() {
      return once(writable, 'drain') as Promise<any>;
    },
    releaseLock() {
      // no-op
    },
    write(chunk: W) {
      const promise = fakePromise();
      if (chunk == null) {
        return promise;
      }
      return promise.then(() => safeWrite(chunk, writable)) as Promise<any>;
    },
    close() {
      if (!writable.errored && writable.closed) {
        return fakePromise();
      }
      if (writable.errored) {
        return fakeRejectPromise(writable.errored);
      }
      return fakePromise().then(() => endStream(writable));
    },
    abort(reason?: any) {
      writable.destroy(reason);
      return once(writable, 'close') as Promise<any>;
    },
  };
}

export class PonyfillWritableStream<W = any> implements WritableStream<W> {
  /**
   * Marker used by isPonyfillWritableStream() so we can identify this class
   * without triggering the lazy `.writable` getter.
   */
  readonly _ponyfillWritable = true;

  /**
   * Lazily-created Node.js Writable. Set directly when the source is already a
   * Writable, otherwise created on first access of the `.writable` getter.
   */
  private _writable?: Writable;

  /**
   * The underlying sink. Stored directly to bypass Node.js Writable overhead
   * when getWriter() is used without ever accessing .writable.
   */
  private _sink?: UnderlyingSink<W>;

  locked = false;

  constructor(underlyingSink?: UnderlyingSink<W> | Writable) {
    if (underlyingSink instanceof Writable) {
      this._writable = underlyingSink;
    } else if (underlyingSink != null) {
      this._sink = underlyingSink;
    }
    // else: empty stream – both remain undefined
  }

  /**
   * Returns (or lazily creates) the Node.js Writable backing this stream.
   * Kept for backward compatibility with pipeline() and other Node.js code.
   */
  get writable(): Writable {
    if (!this._writable) {
      if (this._sink) {
        this._writable = createWritableFromSink(this._sink);
      } else {
        this._writable = new Writable();
      }
    }
    return this._writable;
  }

  set writable(value: Writable) {
    this._writable = value;
    this._sink = undefined;
  }

  getWriter(): WritableStreamDefaultWriter<W> {
    if (this._sink) {
      return createWriterFromSink(this._sink);
    }
    return createWriterFromWritable(this._writable ?? this.writable);
  }

  close(): Promise<void> {
    if (this._sink) {
      const result = this._sink.close?.();
      if (result instanceof Promise) return result;
      return fakePromise();
    }
    const w = this._writable;
    if (!w) return fakePromise();
    if (!w.errored && w.closed) {
      return fakePromise();
    }
    if (w.errored) {
      return fakeRejectPromise(w.errored);
    }
    return fakePromise().then(() => endStream(w));
  }

  abort(reason?: any): Promise<void> {
    if (this._sink) {
      if (this._sink.abort) {
        const result = this._sink.abort(reason);
        if (result instanceof Promise) return result;
      }
      return fakePromise();
    }
    const w = this._writable;
    if (!w) return fakePromise();
    w.destroy(reason);
    return once(w, 'close') as Promise<void>;
  }
}
