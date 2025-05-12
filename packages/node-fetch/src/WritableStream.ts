import { once } from 'node:events';
import { Writable } from 'node:stream';
import { fakeRejectPromise } from '@whatwg-node/promise-helpers';
import { endStream, fakePromise, safeWrite } from './utils.js';

export class PonyfillWritableStream<W = any> implements WritableStream<W> {
  writable: Writable;
  constructor(underlyingSink?: UnderlyingSink<W> | Writable) {
    if (underlyingSink instanceof Writable) {
      this.writable = underlyingSink;
    } else if (underlyingSink) {
      const writable = new Writable({
        write(chunk: W, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
          try {
            const result = underlyingSink.write?.(chunk, controller);
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
          const result = underlyingSink.close?.();
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
      this.writable = writable;
      const abortCtrl = new AbortController();
      const controller: WritableStreamDefaultController = {
        signal: abortCtrl.signal,
        error(e) {
          writable.destroy(e);
        },
      };
      writable.once('error', err => abortCtrl.abort(err));
      writable.once('close', () => abortCtrl.abort());
    } else {
      this.writable = new Writable();
    }
  }

  getWriter(): WritableStreamDefaultWriter<W> {
    const writable = this.writable;
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
        return promise.then(() => safeWrite(chunk, writable));
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
      abort(reason) {
        writable.destroy(reason);
        return once(writable, 'close') as Promise<any>;
      },
    };
  }

  close(): Promise<void> {
    if (!this.writable.errored && this.writable.closed) {
      return fakePromise();
    }
    if (this.writable.errored) {
      return fakeRejectPromise(this.writable.errored);
    }
    return fakePromise().then(() => endStream(this.writable));
  }

  abort(reason: any): Promise<void> {
    this.writable.destroy(reason);
    return once(this.writable, 'close') as Promise<any>;
  }

  locked = false;
}
