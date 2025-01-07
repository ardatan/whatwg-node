import { Writable } from 'node:stream';
import { fakePromise } from './utils.js';

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
      let onabort: EventListener | null;
      let reason: any;
      const controller: WritableStreamDefaultController = {
        signal: {
          any(signals) {
            return AbortSignal.any([...signals]);
          },
          get reason() {
            return reason;
          },
          get aborted() {
            return writable.destroyed;
          },
          addEventListener: (_event: string, eventListener: EventListener) => {
            writable.once('error', eventListener);
            writable.once('close', eventListener);
          },
          removeEventListener: (_event: string, eventListener: EventListener) => {
            writable.off('error', eventListener);
            writable.off('close', eventListener);
          },
          dispatchEvent: (_event: Event) => {
            return false;
          },
          get onabort() {
            return onabort;
          },
          set onabort(value) {
            if (onabort) {
              this.removeEventListener('abort', onabort);
            }
            onabort = value;
            if (onabort) {
              this.addEventListener('abort', onabort);
            }
          },
          throwIfAborted() {
            if (writable.destroyed) {
              throw reason;
            }
          },
        },
        error: e => {
          this.writable.destroy(e);
        },
      };
      this.writable.once('error', err => {
        reason = err;
      });
    } else {
      this.writable = new Writable();
    }
  }

  getWriter(): WritableStreamDefaultWriter<W> {
    const writable = this.writable;
    return {
      closed: new Promise<undefined>(resolve => {
        writable.once('close', () => {
          resolve(undefined);
        });
      }),
      get desiredSize() {
        return writable.writableLength;
      },
      ready: new Promise<undefined>(resolve => {
        writable.once('drain', () => {
          resolve(undefined);
        });
      }),
      releaseLock() {
        // no-op
      },
      write(chunk: W) {
        if (chunk == null) {
          return fakePromise(undefined);
        }
        return new Promise<void>((resolve, reject) => {
          writable.write(chunk, (err: Error | null | undefined) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      },
      close() {
        if (!writable.errored && writable.closed) {
          return fakePromise(undefined);
        }
        return new Promise<void>((resolve, reject) => {
          if (writable.errored) {
            reject(writable.errored);
          } else {
            writable.end((err: Error | null) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          }
        });
      },
      abort(reason) {
        return new Promise<void>(resolve => {
          writable.destroy(reason);
          writable.once('close', resolve);
        });
      },
    };
  }

  close(): Promise<void> {
    if (!this.writable.errored && this.writable.closed) {
      return fakePromise(undefined);
    }
    return new Promise<void>((resolve, reject) => {
      if (this.writable.errored) {
        reject(this.writable.errored);
      } else {
        this.writable.end((err: Error | null) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      }
    });
  }

  abort(reason: any): Promise<void> {
    return new Promise<void>(resolve => {
      this.writable.destroy(reason);
      this.writable.once('close', resolve);
    });
  }

  locked = false;
}
