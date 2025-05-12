import { PonyfillTextDecoder, PonyfillTextEncoder } from './TextEncoderDecoder.js';
import { PonyfillTransformStream } from './TransformStream.js';

export class PonyfillTextDecoderStream
  extends PonyfillTransformStream
  implements TextDecoderStream
{
  private textDecoder: TextDecoder;
  constructor(encoding?: BufferEncoding, options?: TextDecoderOptions) {
    super({
      transform: (chunk, controller) =>
        controller.enqueue(this.textDecoder.decode(chunk, { stream: true })),
    });
    this.textDecoder = new PonyfillTextDecoder(encoding, options);
  }

  get encoding(): string {
    return this.textDecoder.encoding;
  }

  get fatal(): boolean {
    return this.textDecoder.fatal;
  }

  get ignoreBOM(): boolean {
    return this.textDecoder.ignoreBOM;
  }
}

export class PonyfillTextEncoderStream
  extends PonyfillTransformStream
  implements TextEncoderStream
{
  private textEncoder: TextEncoder;
  constructor(encoding?: BufferEncoding) {
    super({
      transform: (chunk, controller) => controller.enqueue(this.textEncoder.encode(chunk)),
    });
    this.textEncoder = new PonyfillTextEncoder(encoding);
  }

  get encoding(): string {
    return this.textEncoder.encoding;
  }

  encode(input: string): Uint8Array {
    return this.textEncoder.encode(input);
  }
}
