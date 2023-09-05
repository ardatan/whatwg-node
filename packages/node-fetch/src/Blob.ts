/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import { PonyfillReadableStream } from './ReadableStream.js';
import { fakePromise, isArrayBufferView } from './utils.js';

interface BlobOptions {
  /**
   * @default 'utf8'
   */
  encoding?: BufferEncoding | undefined;
  /**
   * The Blob content-type. The intent is for `type` to convey
   * the MIME media type of the data, however no validation of the type format
   * is performed.
   */
  type?: string | undefined;
  /**
   * The size of the Blob object in bytes.
   */
  size?: number | null;
}

function getBlobPartAsBuffer(blobPart: Exclude<BlobPart, Blob>) {
  if (typeof blobPart === 'string') {
    return Buffer.from(blobPart);
  } else if (Buffer.isBuffer(blobPart)) {
    return blobPart;
  } else if (isArrayBufferView(blobPart)) {
    return Buffer.from(blobPart.buffer, blobPart.byteOffset, blobPart.byteLength);
  } else {
    return Buffer.from(blobPart);
  }
}

function isBlob(obj: any): obj is Blob {
  return obj != null && obj.arrayBuffer != null;
}

// Will be removed after v14 reaches EOL
// Needed because v14 doesn't have .stream() implemented
export class PonyfillBlob implements Blob {
  type: string;
  private encoding: BufferEncoding;
  private _size: number | null = null;
  constructor(
    private blobParts: BlobPart[],
    options?: BlobOptions,
  ) {
    this.type = options?.type || 'application/octet-stream';
    this.encoding = options?.encoding || 'utf8';
    this._size = options?.size || null;
    if (blobParts.length === 1 && isBlob(blobParts[0])) {
      return blobParts[0] as PonyfillBlob;
    }
  }

  arrayBuffer() {
    if (this.blobParts.length === 1) {
      const blobPart = this.blobParts[0];
      if (isBlob(blobPart)) {
        return blobPart.arrayBuffer() as Promise<Buffer>;
      }
      return fakePromise(getBlobPartAsBuffer(blobPart));
    }
    const jobs: Promise<void>[] = [];
    const bufferChunks: Buffer[] = this.blobParts.map((blobPart, i) => {
      if (isBlob(blobPart)) {
        jobs.push(
          blobPart.arrayBuffer().then(arrayBuf => {
            bufferChunks[i] = Buffer.from(arrayBuf, undefined, blobPart.size);
          }),
        );
        return undefined as any;
      } else {
        return getBlobPartAsBuffer(blobPart);
      }
    });
    if (jobs.length > 0) {
      return Promise.all(jobs).then(() => Buffer.concat(bufferChunks, this._size || undefined));
    }
    return fakePromise(Buffer.concat(bufferChunks, this._size || undefined));
  }

  text() {
    if (this.blobParts.length === 1) {
      const blobPart = this.blobParts[0];
      if (typeof blobPart === 'string') {
        return fakePromise(blobPart);
      }
      if (isBlob(blobPart)) {
        return blobPart.text();
      }
      const buf = getBlobPartAsBuffer(blobPart);
      return fakePromise(buf.toString(this.encoding));
    }
    return this.arrayBuffer().then(buf => buf.toString(this.encoding));
  }

  get size() {
    if (this._size == null) {
      this._size = 0;
      for (const blobPart of this.blobParts) {
        if (typeof blobPart === 'string') {
          this._size += Buffer.byteLength(blobPart);
        } else if (isBlob(blobPart)) {
          this._size += blobPart.size;
        } else if (isArrayBufferView(blobPart)) {
          this._size += blobPart.byteLength;
        }
      }
    }
    return this._size;
  }

  stream(): any {
    if (this.blobParts.length === 1) {
      const blobPart = this.blobParts[0];
      if (isBlob(blobPart)) {
        return blobPart.stream();
      }
      const buf = getBlobPartAsBuffer(blobPart);
      return new PonyfillReadableStream({
        start: controller => {
          controller.enqueue(buf);
          controller.close();
        },
      });
    }
    let blobPartIterator: Iterator<BlobPart> | undefined;
    return new PonyfillReadableStream({
      start: controller => {
        if (this.blobParts.length === 0) {
          controller.close();
          return;
        }
        blobPartIterator = this.blobParts[Symbol.iterator]();
      },
      pull: controller => {
        const { value: blobPart, done } = blobPartIterator!.next();
        if (done) {
          controller.close();
          return;
        }
        if (blobPart) {
          if (isBlob(blobPart)) {
            return blobPart.arrayBuffer().then(arrayBuffer => {
              const buf = Buffer.from(arrayBuffer, undefined, blobPart.size);
              controller.enqueue(buf);
            });
          } else {
            const buf = getBlobPartAsBuffer(blobPart);
            controller.enqueue(buf);
          }
        }
      },
    });
  }

  slice(): any {
    throw new Error('Not implemented');
  }
}

export interface PonyfillBlob {
  prototype: Blob;
  new (blobParts?: BlobPart[], options?: BlobPropertyBag): Blob;
}
