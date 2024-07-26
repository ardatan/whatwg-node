import { createBrotliDecompress, createGunzip, createInflate, createInflateRaw } from 'node:zlib';
import { PonyfillCompressionFormat } from './CompressionStream.js';
import { PonyfillTransformStream } from './TransformStream.js';

export class PonyfillDecompressionStream
  extends PonyfillTransformStream
  implements DecompressionStream
{
  constructor(compressionFormat: PonyfillCompressionFormat) {
    switch (compressionFormat) {
      case 'x-gzip':
      case 'gzip':
        super(createGunzip());
        break;
      case 'x-deflate':
      case 'deflate':
        super(createInflate());
        break;
      case 'deflate-raw':
        super(createInflateRaw());
        break;
      case 'br':
        super(createBrotliDecompress());
        break;
      default:
        throw new Error(`Unsupported compression format: ${compressionFormat}`);
    }
  }
}
