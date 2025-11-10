import zlib from 'node:zlib';
import { PonyfillCompressionFormat } from './CompressionStream.js';
import { PonyfillTransformStream } from './TransformStream.js';
import { getSupportedFormats } from './utils.js';

export class PonyfillDecompressionStream
  extends PonyfillTransformStream
  implements DecompressionStream
{
  static supportedFormats: PonyfillCompressionFormat[] = getSupportedFormats();

  constructor(compressionFormat: PonyfillCompressionFormat) {
    switch (compressionFormat) {
      case 'x-gzip':
      case 'gzip':
        super(zlib.createGunzip());
        break;
      case 'x-deflate':
      case 'deflate':
        super(zlib.createInflate());
        break;
      case 'deflate-raw':
        super(zlib.createInflateRaw());
        break;
      case 'br':
        super(zlib.createBrotliDecompress());
        break;
      case 'zstd':
        super(zlib.createZstdDecompress());
        break;
      default:
        throw new TypeError(`Unsupported compression format: '${compressionFormat}'`);
    }
  }
}
