/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import { PonyfillReadableStream } from './ReadableStream.js';
import { isArrayBufferView } from './utils.js';

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
  constructor(
    private blobParts: BlobPart[],
    options?: BlobOptions,
  ) {
    this.type = options?.type || 'application/octet-stream';
    this.encoding = options?.encoding || 'utf8';
  }

  async buffer() {
    const bufferChunks: Buffer[] = [];
    for (const blobPart of this.blobParts) {
      if (isBlob(blobPart)) {
        const arrayBuf = await blobPart.arrayBuffer();
        const buf = Buffer.from(arrayBuf, undefined, blobPart.size);
        bufferChunks.push(buf);
      } else {
        const buf = getBlobPartAsBuffer(blobPart);
        bufferChunks.push(buf);
      }
    }
    return Buffer.concat(bufferChunks);
  }

  arrayBuffer() {
    return this.buffer().then(buf => buf.buffer);
  }

  async text() {
    let text = '';
    for (const blobPart of this.blobParts) {
      if (typeof blobPart === 'string') {
        text += blobPart;
      } else if (isBlob(blobPart)) {
        text += await blobPart.text();
      } else {
        const buf = getBlobPartAsBuffer(blobPart);
        text += buf.toString(this.encoding);
      }
    }
    return text;
  }

  get size() {
    let size = 0;
    for (const blobPart of this.blobParts) {
      if (typeof blobPart === 'string') {
        size += Buffer.byteLength(blobPart);
      } else if (isBlob(blobPart)) {
        size += blobPart.size;
      } else if (isArrayBufferView(blobPart)) {
        size += blobPart.byteLength;
      }
    }
    return size;
  }

  stream(): any {
    let partQueue: BlobPart[] = [];
    return new PonyfillReadableStream({
      start: controller => {
        partQueue = [...this.blobParts];
        if (partQueue.length === 0) {
          controller.close();
        }
      },
      pull: controller => {
        const blobPart = partQueue.pop();
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
        } else {
          controller.close();
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
