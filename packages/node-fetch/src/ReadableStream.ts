import { Readable } from 'node:stream';
import { handleMaybePromise } from '@whatwg-node/promise-helpers';
import { fakePromise, isAsyncIterable } from './utils.js';

function isNodeReadable(obj: any): obj is Readable {
  return obj?.read != null;
}

function isReadableStream(obj: any): obj is PonyfillReadableStream<any> {
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
      if (!startFlushed) {
        startBuffer.push(chunk);
      } else {
        sharedQueue.push(chunk);
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
            pullBuffer.push(chunk);
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
        if ((pullResult as any)?.then != null) {
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
    if (isNodeReadable(underlyingSource)) {
      const readable = underlyingSource as Readable;
      // UnderlyingSource with start/pull/cancel – use the async generator
      const cancelRef: CancelRef = { reason: undefined };
      this._iterable = createUnderlyingSourceIterable(
        {
          start(controller) {
            readable.on('data', chunk => controller.enqueue(chunk));
            readable.once('end', () => controller.close());
            readable.once('error', (err: unknown) => controller.error(err));
          },
          cancel(reason) {
            if (!readable.destroyed && !readable.closed && !readable.errored) {
              readable.destroy(reason);
            }
          },
        },
        cancelRef,
      );
    } else if (isReadableStream(underlyingSource)) {
      console.log('geldi3', underlyingSource); // --- IGNORE ---
      return underlyingSource;
    } else if (isAsyncIterable(underlyingSource) || isSyncIterable(underlyingSource)) {
      this._iterable = underlyingSource;
    } else if (underlyingSource != null) {
      // UnderlyingSource with start/pull/cancel – use the async generator
      const cancelRef: CancelRef = { reason: undefined };
      this._cancelRef = cancelRef;
      this._iterable = createUnderlyingSourceIterable(underlyingSource, cancelRef);
    }
  }

  cancel(reason?: any): Promise<void> {
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
        return fakePromise();
      },
    };
  }

  [Symbol.asyncIterator](_options?: ReadableStreamIteratorOptions): ReadableStreamAsyncIterator<T> {
    const iterator = this._getIterator();
    const iterable: ReadableStreamAsyncIterator<T> = {
      [Symbol.asyncIterator]() {
        return this;
      },
      [Symbol.asyncDispose]: () => {
        return fakePromise()
          .then(() => iterator.return?.())
          .then(() => undefined);
      },
      next: () => iterator.next() as Promise<IteratorResult<T>>,
      return: (value?: any) => {
        if (iterator.return) {
          return iterator.return(value) as Promise<IteratorResult<T>>;
        }
        return fakePromise({ done: true, value: undefined }) as Promise<IteratorResult<T>>;
      },
      throw: (err?: any) => {
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
      // Iterable-backed source: cancel it with the error reason
      this.cancel(err);
    });
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
