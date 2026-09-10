import { Buffer } from 'node:buffer';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { finished, pipeline } from 'node:stream/promises';
import { fakeRejectPromise, handleMaybePromise } from '@whatwg-node/promise-helpers';
import { fakePromise } from './utils.js';
import { PonyfillWritableStream } from './WritableStream.js';

function createController<T>(
  desiredSize: number,
  readable: Readable,
): ReadableStreamDefaultController<T> & { _flush(): void; _closed: boolean } {
  let chunks: Buffer[] = [];
  let _closed = false;
  let flushed = false;
  return {
    desiredSize,
    enqueue(chunk: any) {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      if (!flushed) {
        chunks.push(buf);
      } else {
        readable.push(buf);
      }
    },
    close() {
      if (chunks.length > 0) {
        this._flush();
      }
      readable.push(null);
      _closed = true;
    },
    error(error: Error) {
      if (chunks.length > 0) {
        this._flush();
      }
      readable.destroy(error);
    },
    get _closed() {
      return _closed;
    },
    _flush() {
      flushed = true;
      if (chunks.length > 0) {
        const concatenated = chunks.length > 1 ? Buffer.concat(chunks) : chunks[0];
        readable.push(concatenated);
        chunks = [];
      }
    },
  };
}

function isNodeReadable(obj: any): obj is Readable {
  return obj?.read != null;
}

function isReadableStream(obj: any): obj is ReadableStream {
  return obj?.getReader != null;
}

/** In-flight cancel(reason); keyed by underlying Readable (not stored on it). */
const pendingCancelReasons = new WeakMap<Readable, { value: any }>();

export class PonyfillReadableStream<T> implements ReadableStream<T> {
  readable: Readable;
  constructor(
    underlyingSource?:
      UnderlyingSource<T> | Readable | ReadableStream<T> | PonyfillReadableStream<T>,
  ) {
    if (underlyingSource instanceof PonyfillReadableStream && underlyingSource.readable != null) {
      this.readable = underlyingSource.readable;
    } else if (isNodeReadable(underlyingSource)) {
      this.readable = underlyingSource as Readable;
    } else if (isReadableStream(underlyingSource)) {
      this.readable = Readable.fromWeb(underlyingSource as Parameters<typeof Readable.fromWeb>[0]);
    } else {
      let started = false;
      let ongoing = false;
      const handleStart = (desiredSize: number) => {
        if (!started) {
          const controller = createController(desiredSize, this.readable);
          started = true;
          return handleMaybePromise(
            () => underlyingSource?.start?.(controller),
            () => {
              controller._flush();
              if (controller._closed) {
                return false;
              }
              return true;
            },
          );
        }
        return true;
      };
      const readImpl = (desiredSize: number) => {
        return handleMaybePromise(
          () => handleStart(desiredSize),
          shouldContinue => {
            if (!shouldContinue) {
              return;
            }
            const controller = createController(desiredSize, this.readable);
            return handleMaybePromise(
              () => underlyingSource?.pull?.(controller),
              () => {
                controller._flush();
                ongoing = false;
              },
            );
          },
        );
      };
      this.readable = new Readable({
        read(desiredSize) {
          if (ongoing) {
            return;
          }
          ongoing = true;
          return readImpl(desiredSize);
        },
        destroy(err, callback) {
          // cancel() sets a pending marker and destroy()s without an error for this path.
          // A racing destroy(otherErr) must still surface as a real failure.
          const pending = pendingCancelReasons.get(this);
          const fromCancel = pending != null && err == null;
          const cancelReason = fromCancel ? pending.value : undefined;
          if (fromCancel) {
            pendingCancelReasons.delete(this);
          }

          if (underlyingSource?.cancel) {
            try {
              const res$ = underlyingSource.cancel(fromCancel ? cancelReason : err);
              if (res$?.then) {
                return res$.then(
                  () => {
                    // Preserve real destroy(err) after the cancel hook runs.
                    callback(fromCancel ? null : (err ?? null));
                  },
                  cancelErr => {
                    callback(cancelErr);
                  },
                );
              }
            } catch (cancelErr: any) {
              callback(cancelErr);
              return;
            }
            callback(fromCancel ? null : (err ?? null));
            return;
          }
          // Explicit cancel must not surface as a stream failure
          if (fromCancel) {
            callback(null);
            return;
          }
          // No cancel hook: propagate destroy(err) so piped destinations observe the failure (#3011)
          callback(err ?? null);
        },
      });
    }
  }

  cancel(reason?: any): Promise<void> {
    if (this.readable.destroyed) {
      const errored = this.readable.errored;
      if (errored != null) {
        return fakeRejectPromise(errored);
      }
      return fakePromise();
    }
    pendingCancelReasons.set(this.readable, { value: reason });
    const readable = this.readable;
    readable.on('error', () => {});
    // Always destroy without an error: cancel intent is in the WeakMap for aware streams.
    // For wrapped streams, pipeThrough forwards cancel(reason) to the source explicitly.
    const whenDone = finished(readable).then(
      () => undefined,
      err => {
        // Swallow intentional cancel artifacts: destroy(reason) on wrapped streams, and
        // ERR_STREAM_PREMATURE_CLOSE from destroy() before the readable is drained.
        // Still propagate cancel-hook failures and racing destroy(err) failures.
        const code = (err as NodeJS.ErrnoException | undefined)?.code;
        if (
          Object.is(err, reason) ||
          code === 'ERR_STREAM_PREMATURE_CLOSE' ||
          (err as Error)?.message === 'Premature close'
        ) {
          return undefined;
        }
        throw err;
      },
    );
    readable.destroy();
    return whenDone.finally(() => {
      pendingCancelReasons.delete(readable);
    });
  }

  locked = false;

  getReader(options: { mode: 'byob' }): ReadableStreamBYOBReader;
  getReader(): ReadableStreamDefaultReader<T>;
  getReader(_options?: ReadableStreamGetReaderOptions): ReadableStreamReader<T> {
    const iterator = this.readable[Symbol.asyncIterator]();
    this.locked = true;
    const thisReadable = this.readable;
    return {
      read() {
        return iterator.next() as Promise<ReadableStreamReadResult<T>>;
      },
      releaseLock: () => {
        if (iterator.return) {
          const retResult$ = iterator.return();
          if (retResult$.then) {
            retResult$.then(() => {
              this.locked = false;
            });
            return;
          }
        }
        this.locked = false;
      },
      cancel: (reason?: any) => {
        this.locked = false;
        // Route through stream cancel so pipeThrough's cancel forwarding still runs.
        return this.cancel(reason);
      },
      get closed() {
        return Promise.race([
          once(thisReadable, 'end'),
          once(thisReadable, 'error').then(err => Promise.reject(err)),
        ]) as Promise<any>;
      },
    };
  }

  [Symbol.asyncIterator](options?: ReadableStreamIteratorOptions): ReadableStreamAsyncIterator<T> {
    const preventCancel = options?.preventCancel === true;
    // Node's default async iterator destroys on return; honor preventCancel via destroyOnReturn.
    const iterator = (
      typeof this.readable.iterator === 'function'
        ? this.readable.iterator({ destroyOnReturn: !preventCancel })
        : this.readable[Symbol.asyncIterator]()
    ) as AsyncIterator<any>;
    const iterable = {
      [Symbol.asyncIterator]() {
        return this;
      },
      [Symbol.asyncDispose]: async () => {
        await iterator.return?.();
        if (!preventCancel && !this.readable.destroyed) {
          this.readable.destroy();
        }
      },
      next: () => iterator.next(),
      return: () => {
        if (!preventCancel && !this.readable.destroyed) {
          this.readable.destroy();
        }
        return iterator.return?.() || fakePromise({ done: true, value: undefined });
      },
      throw: (err: Error) => {
        if (!this.readable.destroyed) {
          this.readable.destroy(err);
        }
        return iterator.throw?.(err) || fakePromise({ done: true, value: undefined });
      },
    };
    return iterable as unknown as ReadableStreamAsyncIterator<T>;
  }

  values(options?: ReadableStreamIteratorOptions): ReadableStreamAsyncIterator<T> {
    return this[Symbol.asyncIterator](options);
  }

  tee(): [ReadableStream<T>, ReadableStream<T>] {
    throw new Error('Not implemented');
  }

  private async pipeToWriter(writer: WritableStreamDefaultWriter<T>): Promise<void> {
    try {
      for await (const chunk of this) {
        await writer.write(chunk);
      }
      await writer.close();
    } catch (err) {
      try {
        await writer.abort(err);
      } catch {
        // Ignore abort failures; still surface the original write/close error.
      }
      throw err;
    }
  }

  pipeTo(destination: WritableStream<T>): Promise<void> {
    if (isPonyfillWritableStream(destination)) {
      return pipeline(this.readable, destination.writable, {
        end: true,
      });
    } else {
      const writer = destination.getWriter();
      return this.pipeToWriter(writer);
    }
  }

  pipeThrough<T2>({
    writable,
    readable,
  }: {
    writable: WritableStream<T>;
    readable: ReadableStream<T2>;
  }): ReadableStream<T2> {
    const pipePromise = this.pipeTo(writable);
    pipePromise.catch(err => {
      if (!this.readable.destroyed) {
        this.readable.on('error', () => {});
        this.readable.destroy(err);
      }
    });
    if (isPonyfillReadableStream(readable)) {
      const onError = (err: Error) => {
        if (!this.readable.destroyed) {
          this.readable.on('error', () => {});
          this.readable.destroy(err);
        }
      };
      const onEnd = () => {
        if (!this.readable.destroyed && !this.readable.readableEnded) {
          this.readable.push(null);
        }
      };
      readable.readable.once('error', onError);
      readable.readable.once('finish', onEnd);
      readable.readable.once('close', onEnd);
      // finally() re-settles like the original promise — must catch or it becomes unhandled.
      pipePromise
        .finally(() => {
          readable.readable.off('error', onError);
          readable.readable.off('finish', onEnd);
          readable.readable.off('close', onEnd);
        })
        .catch(() => {});

      // Forward cancel(reason) to the source first (sequential) so a racing pipeline
      // destroy(err) cannot overwrite the cancel reason with ERR_STREAM_PREMATURE_CLOSE.
      const outCancel = readable.cancel.bind(readable);
      readable.cancel = async (reason?: any) => {
        await this.cancel(reason);
        try {
          await outCancel(reason);
        } catch {
          // Transform may already be closed by the pipeline after source cancel.
        }
      };
    }
    return readable;
  }

  static [Symbol.hasInstance](instance: unknown): instance is PonyfillReadableStream<unknown> {
    return isReadableStream(instance);
  }

  static from<T>(iterable: AsyncIterable<T> | Iterable<T>): PonyfillReadableStream<T> {
    return new PonyfillReadableStream(Readable.from(iterable));
  }

  [Symbol.toStringTag] = 'ReadableStream';
}

function isPonyfillReadableStream(obj: any): obj is PonyfillReadableStream<any> {
  return obj?.readable != null;
}

function isPonyfillWritableStream(obj: any): obj is PonyfillWritableStream {
  return obj?.writable != null;
}
