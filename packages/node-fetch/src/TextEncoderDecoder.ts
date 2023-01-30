export class PonyfillTextEncoder implements TextEncoder {
  constructor(public encoding: BufferEncoding = 'utf-8') {}

  encode(input: string): Buffer {
    return Buffer.from(input, this.encoding);
  }

  encodeInto(source: string, destination: Uint8Array): TextEncoderEncodeIntoResult {
    const buffer = this.encode(source);
    const copied = buffer.copy(destination);
    return {
      read: copied,
      written: copied,
    };
  }
}

export class PonyfillTextDecoder implements TextDecoder {
  fatal = false;
  ignoreBOM = false;
  constructor(public encoding: BufferEncoding = 'utf-8', options: TextDecoderOptions) {
    if (options) {
      this.fatal = options.fatal || false;
      this.ignoreBOM = options.ignoreBOM || false;
    }
  }

  decode(input: Uint8Array): string {
    return Buffer.from(input).toString(this.encoding);
  }
}

export function PonyfillBtoa(input: string): string {
  return Buffer.from(input, 'binary').toString('base64');
}
