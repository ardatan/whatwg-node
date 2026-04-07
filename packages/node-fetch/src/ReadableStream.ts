import { Buffer } from 'node:buffer';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fakeRejectPromise, handleMaybePromise } from '@whatwg-node/promise-helpers';
import { fakePromise, isAsyncIterable } from './utils.js';
import { PonyfillWritableStream } from './WritableStream.js';

function isNodeReadable(obj: any): obj is Readable {
  return obj?.read != null;
}

function isReadableStream(obj: any): obj is ReadableStream {
  return obj?.getReader != null;
}

function isSyncIterable(obj: any): obj is Iterable<unknown> {
  return obj?.[Symbol.iterator] != null;
}

/** Shared mutable cancel-reason ref threaded into the generator closure. */
interface CancelRef {
  reason: unknown;
  /** Resolves the current wait inside the generator so it can check for cancellation. */
  wake?: () => void;
  /** Flag set when the stream is cancelled, causing the generator loop to exit. */
  cancelled?: boolean;
}

/**
 * Async generator that drives an UnderlyingSource (start/pull/cancel) directly,
 * without creating a Node.js Readable. This avoids stream event-emitter overhead
 * for custom sources and is the performance-critical path.
 */
function createUnderlyingSourceIterable<T>(
  source: UnderlyingSource<T>,
  cancelRef: CancelRef,
): AsyncGenerator<T, void, undefined> {
  // Shared queue for chunks enqueued by both start (via interval/timeout) and pull
  const sharedQueue: T[] = [];
  let closed = false;
  let closeError: unknown;

  // Internal notify: resolves the current `await` inside the generator.
  // The cancelRef.wake is pointed to this function so external cancel() can wake us.
  let internalWake: (() => void) | null = null;

  function wake() {
    if (internalWake) {
      const w = internalWake;
      internalWake = null;
      w();
    }
  }

  // Wire up the cancelRef so external cancel() can wake the generator
  cancelRef.wake = wake;

  // The start controller: after start() returns, enqueues go directly into the shared queue
  let startFlushed = false;
  const startBuffer: T[] = [];

  const startController: ReadableStreamDefaultController<T> = {
    desiredSize: 1,
    enqueue(chunk: T) {
      const value = (typeof chunk === 'string' ? Buffer.from(chunk) : chunk) as T;
      if (!startFlushed) {
        startBuffer.push(value);
      } else {
        sharedQueue.push(value);
        wake();
      }
    },
    close() {
      closed = true;
      wake();
    },
    error(err: unknown) {
      closeError = err;
      wake();
    },
  };

  // Call start (may be sync or async)
  const startResult = source.start?.(startController);
  async function* createUnderlyingSourceIterableGen() {
    await startResult;

    // Flush any chunks enqueued synchronously during start
    startFlushed = true;
    for (const chunk of startBuffer) {
      sharedQueue.push(chunk);
    }
    startBuffer.length = 0;

    try {
      while (!cancelRef.cancelled) {
        // Yield everything currently in the shared queue
        while (sharedQueue.length > 0) {
          yield sharedQueue.shift()!;
        }

        if (closed || closeError !== undefined || cancelRef.cancelled) break;

        if (!source.pull) {
          // No pull defined – wait for start's async enqueues (e.g. setInterval) or cancel
          await new Promise<void>(resolve => {
            internalWake = resolve;
          });
          internalWake = null;
          continue;
        }

        // Call pull with its own local buffer controller; flush after pull resolves
        const pullBuffer: T[] = [];
        let pullClosed = false;
        let pullError: unknown;

        const pullController: ReadableStreamDefaultController<T> = {
          desiredSize: 1,
          enqueue(chunk: T) {
            const value = (typeof chunk === 'string' ? Buffer.from(chunk) : chunk) as T;
            pullBuffer.push(value);
          },
          close() {
            pullClosed = true;
            closed = true;
          },
          error(err: unknown) {
            pullError = err;
          },
        };

        const pullResult = source.pull(pullController);
        if (pullResult != null && typeof (pullResult as any).then === 'function') {
          // Async pull: yield from the shared queue while waiting so that concurrent
          // enqueues from start (e.g. setInterval) are emitted in the right order.
          let pullDone = false;
          (pullResult as Promise<unknown>).then(
            () => {
              pullDone = true;
              wake();
            },
            (err: unknown) => {
              pullError = err;
              pullDone = true;
              wake();
            },
          );

          // Loop until pull resolves or stream is cancelled
          for (;;) {
            while (sharedQueue.length > 0) {
              yield sharedQueue.shift()!;
            }
            if (pullDone || cancelRef.cancelled) break;
            await new Promise<void>(resolve => {
              internalWake = resolve;
            });
            internalWake = null;
          }
          if (cancelRef.cancelled) break;
          // Drain any remaining shared-queue items that arrived while pull was finishing
          while (sharedQueue.length > 0) {
            yield sharedQueue.shift()!;
          }
        }

        if (pullError !== undefined) throw pullError;

        // Flush pull's local buffer into the main generator output
        for (const chunk of pullBuffer) {
          sharedQueue.push(chunk);
        }

        if (pullClosed) break;
      }

      // Yield any items left over after the loop exits
      while (sharedQueue.length > 0) {
        yield sharedQueue.shift()!;
      }

      if (closeError !== undefined) throw closeError;
    } finally {
      source.cancel?.(cancelRef.reason);
    }
  }
  return createUnderlyingSourceIterableGen();
}

export class PonyfillReadableStream<T> implements ReadableStream<T> {
  /**
   * Marker used by isPonyfillReadableStream() so we avoid triggering the lazy
   * `.readable` getter just to check the stream type.
   */
  readonly _ponyfillReadable = true;

  /**
   * Lazily-created Node.js Readable. Set directly when the source is already a
   * Readable, otherwise created on first access of the `.readable` getter.
   */
  _readable?: Readable;

  /**
   * The fast-path async/sync iterable backing this stream. Used by getReader()
   * and [Symbol.asyncIterator]() to bypass Node.js stream overhead.
   */
  _iterable?: AsyncIterable<T> | Iterable<T> | undefined;

  /**
   * The single active iterator created from _iterable. Stored here so that
   * subsequent calls to the `.readable` getter wrap the *same* iterator state,
   * guaranteeing single-consumer semantics.
   */
  private _activeIterator?: AsyncIterator<T> | Iterator<T> | undefined;

  /**
   * For UnderlyingSource-backed streams: shared ref so cancel(reason) can
   * pass the reason into the generator's finally block.
   */
  private _cancelRef?: CancelRef;

  locked = false;

  constructor(
    underlyingSource?:
      | UnderlyingSource<T>
      | Readable
      | ReadableStream<T>
      | PonyfillReadableStream<T>
      | AsyncIterable<T>
      | Iterable<T>,
  ) {
    if ((underlyingSource as any)?._ponyfillReadable === true) {
      // Fast-copy internal state instead of going through the public getter
      const src = underlyingSource as PonyfillReadableStream<T>;
      if (src._readable != null) {
        this._readable = src._readable;
      } else if (src._iterable != null) {
        this._iterable = src._iterable;
      }
    } else if (isNodeReadable(underlyingSource)) {
      this._readable = underlyingSource as Readable;
    } else if (isReadableStream(underlyingSource)) {
      // Web ReadableStream: drive via its own reader without creating a Node Readable.
      // Convert chunks to Buffer so callers get the same type as Node.js streams.
      const stream = underlyingSource as ReadableStream<T>;
      this._iterable = (async function* () {
        const reader = stream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            // Ensure we yield a Buffer so toString('utf-8') etc. work correctly
            yield value != null && !Buffer.isBuffer(value) && (value as any).byteLength != null
              ? (Buffer.from(value as unknown as Uint8Array) as unknown as T)
              : value;
          }
        } finally {
          reader.releaseLock();
        }
      })();
    } else if (isAsyncIterable(underlyingSource) || isSyncIterable(underlyingSource)) {
      this._iterable = underlyingSource as AsyncIterable<T> | Iterable<T>;
    } else if (underlyingSource != null) {
      // UnderlyingSource with start/pull/cancel – use the async generator
      const cancelRef: CancelRef = { reason: undefined };
      this._cancelRef = cancelRef;
      this._iterable = createUnderlyingSourceIterable(
        underlyingSource as UnderlyingSource<T>,
        cancelRef,
      );
    }
    // else: empty stream – both remain undefined
  }

  /**
   * Returns (or lazily creates) the Node.js Readable backing this stream.
   * Kept for backward compatibility with code that accesses `.readable` directly
   * (e.g. Body.ts). When the source is an iterable the Readable is created on
   * first access and wraps the *same* iterator state.
   */
  generateReadable(): Readable {
    if (!this._readable) {
      if (this._activeIterator) {
        // An iterator was already created via getReader / asyncIterator –
        // wrap it so both paths share the same consumer position.
        const iter = this._activeIterator;
        this._activeIterator = undefined;
        const wrapped: AsyncIterable<T> = {
          [Symbol.asyncIterator]() {
            return {
              next: () => fakePromise(iter.next()),
              return: (value?: any) =>
                fakePromise(iter.return ? iter.return(value) : { done: true, value }),
              throw: (err?: any) =>
                iter.throw ? fakePromise(iter.throw(err)) : fakeRejectPromise(err),
            };
          },
        };
        this._readable = Readable.from(wrapped);
      } else if (this._iterable != null) {
        this._readable = Readable.from(this._iterable as AsyncIterable<T>);
      } else {
        // Empty stream
        const r = new Readable({ read() {} });
        r.push(null);
        this._readable = r;
      }
      // For UnderlyingSource-backed streams, patch _destroy on the Readable so that when
      // it is destroyed (e.g. due to HTTP client abort), the generator is woken via
      // cancelRef.wake() BEFORE the original _destroy calls generator.return().
      // This is necessary because Readable.from(asyncGenerator) calls generator.return()
      // inside _destroy, but when generator.next() is pending, generator.return() returns
      // a Promise that never resolves (V8 bug). Waking the generator one microtask ahead
      // lets it exit naturally so that generator.return() then succeeds immediately.
      if (this._cancelRef) {
        const cancelRef = this._cancelRef;
        const readable = this._readable;
        const origDestroy = readable._destroy.bind(readable);
        readable._destroy = (err: Error | null, cb: (err?: Error | null) => void) => {
          if (!cancelRef.cancelled) {
            cancelRef.reason = err ?? undefined;
            cancelRef.cancelled = true;
            cancelRef.wake?.();
          }
          // Call origDestroy without the error so the stream emits only 'close', not
          // 'error' + 'close'.  This prevents once(readable, 'close') from rejecting.
          origDestroy(null, cb);
        };
      }
    }
    return this._readable;
  }

  regenerateReadableFromValue(value: Uint8Array) {
    this._readable = Readable.from(value);
    this._iterable = undefined;
    this._activeIterator = undefined;
  }

  cancel(reason?: any): Promise<void> {
    if (this._readable) {
      // Also wake the generator via cancelRef so that the source's cancel() callback
      // is invoked even when V8's generator.return() is a no-op (next() pending).
      if (this._cancelRef && !this._cancelRef.cancelled) {
        this._cancelRef.reason = reason;
        this._cancelRef.cancelled = true;
        this._cancelRef.wake?.();
      }
      // Build a close-waiter that resolves on both 'close' and 'error' so that
      // destroy(reason) can still emit 'error' (needed for pipeThrough error
      // propagation) without creating an unhandled rejection via events.once.
      const readable = this._readable;
      const waitForClose = new Promise<void>(resolve => {
        readable.once('close', resolve);
        readable.once('error', () => resolve());
      });
      readable.destroy(reason instanceof Error ? reason : undefined);
      return waitForClose;
    }
    if (this._cancelRef) {
      this._cancelRef.reason = reason;
      this._cancelRef.cancelled = true;
      // Wake up any awaiting wait inside the generator so it can check the flag
      this._cancelRef.wake?.();
    }
    if (this._activeIterator?.return) {
      return fakePromise(this._activeIterator.return(reason)).then(() => {});
    }
    return fakePromise();
  }

  /** Returns the active iterator, creating it from the iterable if needed. */
  private _getIterator(): AsyncIterator<T> | Iterator<T> {
    if (this._readable) {
      return this._readable[Symbol.asyncIterator]();
    }
    if (this._activeIterator) {
      return this._activeIterator;
    }
    const iterable = this._iterable;
    if (iterable == null) {
      const emptyIter = [][Symbol.iterator]() as unknown as Iterator<T>;
      this._activeIterator = emptyIter;
      return emptyIter;
    }
    let iter: Iterator<T> | AsyncIterator<T>;
    if (isAsyncIterable(iterable)) {
      iter = iterable[Symbol.asyncIterator]();
    } else {
      iter = iterable[Symbol.iterator]();
    }
    this._activeIterator = iter;
    return iter;
  }

  getReader(options: { mode: 'byob' }): ReadableStreamBYOBReader;
  getReader(): ReadableStreamDefaultReader<T>;
  getReader(_options?: ReadableStreamGetReaderOptions): ReadableStreamReader<T> {
    const iterator = this._getIterator();
    this.locked = true;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const thisStream = this;
    const thisReadable = this._readable;
    return {
      read() {
        return fakePromise(iterator.next());
      },
      releaseLock: () => {
        if (iterator.return) {
          return handleMaybePromise(
            () => iterator.return!(),
            () => {
              thisStream.locked = false;
            },
          );
        }
        thisStream.locked = false;
      },
      cancel: (reason?: any) => {
        // Propagate cancel reason into the generator's finally block
        if (thisStream._cancelRef) {
          thisStream._cancelRef.reason = reason;
          thisStream._cancelRef.cancelled = true;
          thisStream._cancelRef.wake?.();
        }
        if (iterator.return) {
          return fakePromise(iterator.return(reason)).then(() => {
            thisStream.locked = false;
          });
        }
        thisStream.locked = false;
        return fakePromise();
      },
      get closed() {
        if (thisReadable) {
          return Promise.race([
            once(thisReadable, 'end'),
            once(thisReadable, 'error').then(err => fakeRejectPromise(err)),
          ]) as Promise<any>;
        }
        return fakePromise() as Promise<undefined>;
      },
    };
  }

  [Symbol.asyncIterator](_options?: ReadableStreamIteratorOptions): ReadableStreamAsyncIterator<T> {
    const iterator = this._getIterator();
    const thisReadable = this._readable;
    const iterable: ReadableStreamAsyncIterator<T> = {
      [Symbol.asyncIterator]() {
        return this;
      },
      [Symbol.asyncDispose]: () => {
        return fakePromise()
          .then(() => iterator.return?.())
          .then(() => {
            if (thisReadable && !thisReadable.destroyed) {
              thisReadable.destroy();
            }
          });
      },
      next: () => iterator.next() as Promise<IteratorResult<T>>,
      return: (value?: any) => {
        if (thisReadable && !thisReadable.destroyed) {
          thisReadable.destroy();
        }
        if (iterator.return) {
          return iterator.return(value) as Promise<IteratorResult<T>>;
        }
        return fakePromise({ done: true, value: undefined }) as Promise<IteratorResult<T>>;
      },
      throw: (err?: any) => {
        if (thisReadable && !thisReadable.destroyed) {
          thisReadable.destroy(err);
        }
        if (iterator.throw) {
          return iterator.throw(err) as Promise<IteratorResult<T>>;
        }
        return fakePromise({ done: true, value: undefined }) as Promise<IteratorResult<T>>;
      },
    };
    return iterable;
  }

  values(_options?: ReadableStreamIteratorOptions): ReadableStreamAsyncIterator<T> {
    return this[Symbol.asyncIterator]();
  }

  tee(): [ReadableStream<T>, ReadableStream<T>] {
    throw new Error('Not implemented');
  }

  private async _pipeToWriter(writer: WritableStreamDefaultWriter<T>): Promise<void> {
    try {
      for await (const chunk of this) {
        await writer.write(chunk);
      }
      await writer.close();
    } catch (err) {
      await writer.abort(err);
    }
  }

  pipeTo(destination: WritableStream<T>): Promise<void> {
    if (isPonyfillWritableStream(destination)) {
      const dest = destination as PonyfillWritableStream<T>;
      if (this._readable) {
        // Both sides can use the Node.js pipeline for large-stream efficiency
        return pipeline(this._readable, dest.writable, { end: true });
      }
      // Source is iterable-backed: use writer to avoid creating a Readable
    }
    const writer = destination.getWriter();
    return this._pipeToWriter(writer);
  }

  pipeThrough<T2>({
    writable,
    readable,
  }: {
    writable: WritableStream<T>;
    readable: ReadableStream<T2>;
  }): ReadableStream<T2> {
    this.pipeTo(writable).catch(err => {
      if (this._readable) {
        // Readable-backed source: destroy it
        this._readable.destroy(err);
      } else {
        // Iterable-backed source: cancel it with the error reason
        this.cancel(err);
      }
    });
    if (isPonyfillReadableStream(readable)) {
      const r = readable as PonyfillReadableStream<T2>;
      if (r._readable) {
        r._readable.once('error', err => {
          if (this._readable) {
            this._readable.destroy(err);
          } else {
            // Iterable-backed source: propagate cancellation with the error reason
            this.cancel(err);
          }
        });
        r._readable.once('finish', () => {
          if (this._readable) this._readable.push(null);
        });
        r._readable.once('close', () => {
          if (this._readable) this._readable.push(null);
        });
      }
    }
    return readable;
  }

  static [Symbol.hasInstance](instance: unknown): instance is PonyfillReadableStream<unknown> {
    return isReadableStream(instance);
  }

  static from<T>(iterable: AsyncIterable<T> | Iterable<T>): PonyfillReadableStream<T> {
    return new PonyfillReadableStream<T>(iterable);
  }

  [Symbol.toStringTag] = 'ReadableStream';
}

function isPonyfillReadableStream(obj: any): obj is PonyfillReadableStream<any> {
  return obj?._ponyfillReadable === true;
}

function isPonyfillWritableStream(obj: any): obj is PonyfillWritableStream {
  return obj?._ponyfillWritable === true;
}
