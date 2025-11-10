import zlib from 'node:zlib';
import { PonyfillCompressionFormat } from './CompressionStream.js';
import { PonyfillTransformStream } from './TransformStream.js';

export class PonyfillDecompressionStream
  extends PonyfillTransformStream
  implements DecompressionStream
{
  static supportedFormats: PonyfillCompressionFormat[] = globalThis.process?.version?.startsWith(
    'v2',
  )
    ? ['gzip', 'deflate', 'br', 'zstd']
    : ['gzip', 'deflate', 'deflate-raw', 'br'];

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
