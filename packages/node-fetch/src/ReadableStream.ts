import { Readable } from 'stream';

function createController<T>(
  desiredSize: number,
  readable: Readable
): ReadableStreamDefaultController<T> & { _flush(): void } {
  let chunks: Buffer[] = [];
  return {
    desiredSize,
    enqueue(chunk: any) {
      chunks.push(Buffer.from(chunk));
    },
    close() {
      if (chunks.length > 0) {
        this._flush();
      }
      readable.push(null);
    },
    error(error: Error) {
      if (chunks.length > 0) {
        this._flush();
      }
      readable.destroy(error);
    },
    _flush() {
      if (chunks.length > 0) {
        const concatenated = Buffer.concat(chunks);
        readable.push(concatenated);
        chunks = [];
      }
    },
  };
}

export class PonyfillReadableStream<T> implements ReadableStream<T> {
  readable: Readable;
  constructor(underlyingSource?: UnderlyingSource<T> | Readable | ReadableStream<T> | PonyfillReadableStream<T>) {
    if (underlyingSource instanceof PonyfillReadableStream) {
      this.readable = underlyingSource.readable;
    } else if (underlyingSource && 'read' in underlyingSource) {
      this.readable = underlyingSource as Readable;
    } else if (underlyingSource && 'getReader' in underlyingSource) {
      let reader: ReadableStreamDefaultReader<T>;
      let started = false;
      this.readable = new Readable({
        read() {
          if (!started) {
            started = true;
            reader = underlyingSource.getReader();
          }
          reader
            .read()
            .then(({ value, done }) => {
              if (done) {
                this.push(null);
              } else {
                this.push(value);
              }
            })
            .catch(err => {
              this.destroy(err);
            });
        },
        destroy(err, callback) {
          reader.cancel(err).then(() => callback(err), callback);
        },
      });
    } else {
      let started = false;
      this.readable = new Readable({
        async read(desiredSize) {
          const controller = createController(desiredSize, this);
          if (!started) {
            started = true;
            await underlyingSource?.start?.(controller);
          }
          await underlyingSource?.pull?.(controller);
          controller._flush();
        },
        async destroy(err, callback) {
          try {
            await underlyingSource?.cancel?.(err);
            callback(null);
          } catch (err: any) {
            callback(err);
          }
        },
      });
    }
  }

  cancel(reason?: any): Promise<void> {
    this.readable.destroy(reason);
    return Promise.resolve();
  }

  locked = false;

  getReader(options: { mode: 'byob' }): ReadableStreamBYOBReader;
  getReader(): ReadableStreamDefaultReader<T>;
  getReader(_options?: ReadableStreamGetReaderOptions): ReadableStreamReader<T> {
    const iterator = this.readable[Symbol.asyncIterator]();
    this.locked = true;
    return {
      read() {
        return iterator.next() as any;
      },
      releaseLock: () => {
        iterator.return?.();
        this.locked = false;
      },
      cancel: async (reason?: any) => {
        await iterator.return?.(reason);
        this.locked = false;
      },
      closed: new Promise((resolve, reject) => {
        this.readable.once('end', resolve);
        this.readable.once('error', reject);
      }),
    };
  }

  [Symbol.asyncIterator]() {
    return this.readable[Symbol.asyncIterator]();
  }

  tee(): [ReadableStream<T>, ReadableStream<T>] {
    throw new Error('Not implemented');
  }

  async pipeTo(destination: WritableStream<T>): Promise<void> {
    const writer = destination.getWriter();
    await writer.ready;
    for await (const chunk of this.readable) {
      await writer.write(chunk);
    }
    await writer.ready;
    return writer.close();
  }

  pipeThrough<T2>({
    writable,
    readable,
  }: {
    writable: WritableStream<T>;
    readable: ReadableStream<T2>;
  }): ReadableStream<T2> {
    this.pipeTo(writable);
    return readable;
  }

  static [Symbol.hasInstance](instance: unknown): instance is PonyfillReadableStream<unknown> {
    return instance != null && typeof instance === 'object' && 'getReader' in instance;
  }
}
