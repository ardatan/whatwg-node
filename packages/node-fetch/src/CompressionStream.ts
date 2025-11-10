import zlib from 'node:zlib';
import { PonyfillTransformStream } from './TransformStream.js';

export type PonyfillCompressionFormat =
  | 'x-gzip'
  | 'gzip'
  | 'x-deflate'
  | 'deflate'
  | 'deflate-raw'
  | 'br'
  | 'zstd';

export class PonyfillCompressionStream
  extends PonyfillTransformStream
  implements CompressionStream
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
        super(zlib.createGzip());
        break;
      case 'x-deflate':
      case 'deflate':
        super(zlib.createDeflate());
        break;
      case 'deflate-raw':
        super(zlib.createDeflateRaw());
        break;
      case 'br':
        super(zlib.createBrotliCompress());
        break;
      case 'zstd':
        super(zlib.createZstdCompress());
        break;
      default:
        throw new Error(`Unsupported compression format: ${compressionFormat}`);
    }
  }
}
