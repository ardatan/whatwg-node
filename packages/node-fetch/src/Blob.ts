import { BlobOptions } from 'buffer';
import { PonyfillReadableStream } from './ReadableStream';
import { uint8ArrayToBuffer } from './utils';

function getBlobPartAsBuffer(blobPart: Exclude<BlobPart, Blob>) {
  if (typeof blobPart === 'string') {
    return Buffer.from(blobPart);
  } else if (Buffer.isBuffer(blobPart)) {
    return blobPart;
  } else if (blobPart instanceof Uint8Array) {
    return Buffer.from(blobPart);
  } else if ('buffer' in blobPart) {
    return Buffer.from(blobPart as Buffer);
  } else {
    return Buffer.from(blobPart);
  }
}

function isBlob(obj: any): obj is Blob {
  return obj != null && typeof obj === 'object' && obj.stream != null;
}

// Will be removed after v14 reaches EOL
// Needed because v14 doesn't have .stream() implemented
export class PonyfillBlob implements Blob {
  type: string;
  encoding: string;
  constructor(private blobParts: BlobPart[], options?: BlobOptions) {
    this.type = options?.type || 'application/octet-string';
    this.encoding = options?.encoding || 'utf8'
  }

  async arrayBuffer() {
    const bufferChunks: Buffer[] = [];
    for (const blobPart of this.blobParts) {
      if (isBlob(blobPart)) {
        const arrayBuf = await blobPart.arrayBuffer();
        const buf = Buffer.from(arrayBuf, undefined, blobPart.size);
        bufferChunks.push(buf)
      } else {
        const buf = getBlobPartAsBuffer(blobPart);
        bufferChunks.push(buf);
      }
    }
    return uint8ArrayToBuffer(Buffer.concat(bufferChunks));
  }

  async text() {
    let text = '';
    for (const blobPart of this.blobParts) {
      if (typeof blobPart === 'string') {
        text += blobPart;
      } else if ('text' in blobPart) {
        text += await blobPart.text()
      } else {
        const buf = getBlobPartAsBuffer(blobPart);
        return buf.toString(this.encoding as BufferEncoding);
      }
    }
    return text;
  }

  get size() {
    let size = 0;
    for (const blobPart of this.blobParts) {
      if (typeof blobPart === 'string') {
        size += Buffer.byteLength(blobPart)
      } else if (isBlob(blobPart)) {
        size += blobPart.size
      } else if ('length' in blobPart) {
        size += (blobPart as Buffer).length;
      } else if ('byteLength' in blobPart) {
        size += blobPart.byteLength;
      }
    }
    return size;
  }

  stream(): any {
    return new PonyfillReadableStream({
      pull: async controller => {
        const blobPart = this.blobParts.pop();
        if (blobPart) {
          if (isBlob(blobPart)) {
            for await (const chunk of blobPart.stream() as any) {
              controller.enqueue(chunk);
            }
          } else {
            const buf = getBlobPartAsBuffer(blobPart);
            controller.enqueue(buf);
          }
        } else {
          controller.close();
        }
      }
    });
  }

  slice(): any {
    throw new Error('Not implemented')
  }
}

export interface PonyfillBlob {
  prototype: Blob;
  new (blobParts?: BlobPart[], options?: BlobPropertyBag): Blob;
}
