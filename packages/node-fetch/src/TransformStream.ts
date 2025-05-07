import { Transform } from 'node:stream';
import { PonyfillReadableStream } from './ReadableStream.js';
import { endStream } from './utils.js';
import { PonyfillWritableStream } from './WritableStream.js';

export class PonyfillTransformStream<I = any, O = any> implements TransformStream<I, O> {
  transform: Transform;
  writable: PonyfillWritableStream<I>;
  readable: PonyfillReadableStream<O>;

  constructor(transformer?: Transformer<I, O> | Transform) {
    if (transformer instanceof Transform) {
      this.transform = transformer;
    } else if (transformer) {
      const controller: TransformStreamDefaultController = {
        enqueue(chunk: O) {
          transform.push(chunk);
        },
        error(reason: any) {
          transform.destroy(reason);
        },
        terminate() {
          endStream(transform);
        },
        get desiredSize() {
          return transform.writableLength;
        },
      };
      const transform = new Transform({
        read() {},
        write(chunk: I, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
          try {
            const result = transformer.transform?.(chunk, controller);
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
          try {
            const result = transformer.flush?.(controller);
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
      });
      this.transform = transform;
    } else {
      this.transform = new Transform();
    }
    this.writable = new PonyfillWritableStream(this.transform);
    this.readable = new PonyfillReadableStream(this.transform);
  }
}
