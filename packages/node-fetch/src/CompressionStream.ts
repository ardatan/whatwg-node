import { createBrotliCompress, createDeflate, createDeflateRaw, createGzip } from 'node:zlib';
import { PonyfillTransformStream } from './TransformStream.js';

export type PonyfillCompressionFormat =
  | 'x-gzip'
  | 'gzip'
  | 'x-deflate'
  | 'deflate'
  | 'deflate-raw'
  | 'br';

export class PonyfillCompressionStream
  extends PonyfillTransformStream
  implements CompressionStream
{
  static supportedFormats: PonyfillCompressionFormat[] = globalThis.process?.version?.startsWith(
    'v2',
  )
    ? ['gzip', 'deflate', 'br']
    : ['gzip', 'deflate', 'deflate-raw', 'br'];

  constructor(compressionFormat: PonyfillCompressionFormat) {
    switch (compressionFormat) {
      case 'x-gzip':
      case 'gzip':
        super(createGzip());
        break;
      case 'x-deflate':
      case 'deflate':
        super(createDeflate());
        break;
      case 'deflate-raw':
        super(createDeflateRaw());
        break;
      case 'br':
        super(createBrotliCompress());
        break;
      default:
        throw new Error(`Unsupported compression format: ${compressionFormat}`);
    }
  }
}
