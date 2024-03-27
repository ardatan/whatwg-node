import { Readable } from 'stream';

try {
  const originalReadableFromWeb = Readable.fromWeb;

  Readable.fromWeb = function fromWeb(stream: any): Readable {
    if (stream instanceof PonyfillReadableStream) {
      return stream.readable;
    }
    return originalReadableFromWeb(stream as any);
  };
} catch (e) {
  console.warn(
    'Could not patch Readable.fromWeb, so this might break Readable.fromWeb usage with the whatwg-node and the integrations like Fastify',
    e,
  );
}

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

export class PonyfillReadableStream<T> implements ReadableStream<T> {
  readable: Readable;
  constructor(
    underlyingSource?:
      | UnderlyingSource<T>
      | Readable
      | ReadableStream<T>
      | PonyfillReadableStream<T>,
  ) {
    if (underlyingSource instanceof PonyfillReadableStream && underlyingSource.readable != null) {
      this.readable = underlyingSource.readable;
    } else if (isNodeReadable(underlyingSource)) {
      this.readable = underlyingSource as Readable;
    } else if (isReadableStream(underlyingSource)) {
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
      let ongoing = false;
      this.readable = new Readable({
        read(desiredSize) {
          if (ongoing) {
            return;
          }
          ongoing = true;
          return Promise.resolve().then(async () => {
            if (!started) {
              const controller = createController(desiredSize, this);
              started = true;
              await underlyingSource?.start?.(controller);
              controller._flush();
              if (controller._closed) {
                return;
              }
            }
            const controller = createController(desiredSize, this);
            await underlyingSource?.pull?.(controller);
            controller._flush();
            ongoing = false;
          });
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
    return isReadableStream(instance);
  }

  [Symbol.toStringTag] = 'ReadableStream';
}
