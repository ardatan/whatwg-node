import { PonyfillReadableStream } from '../src/ReadableStream';
import { PonyfillTextEncoder } from '../src/TextEncoderDecoder';
import {
  PonyfillTextDecoderStream,
  PonyfillTextEncoderStream,
} from '../src/TextEncoderDecoderStream';

describe('TextEncoderDecoderStream', () => {
  it('TextEncoderStream', async () => {
    const readableStream = new PonyfillReadableStream({
      start(controller) {
        controller.enqueue(Buffer.from('Hello, '));
        controller.enqueue(Buffer.from('world!'));
        controller.close();
      },
    });
    const pipedStream = readableStream.pipeThrough(new PonyfillTextEncoderStream());
    const reader = pipedStream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
    }
    const encoded = Buffer.concat(chunks);
    expect(encoded.toString('utf-8')).toBe('Hello, world!');
  });
  it('TextDecoderStream', async () => {
    const textEncoder = new PonyfillTextEncoder();
    const decodedHello = textEncoder.encode('Hello, ');
    const decodedWorld = textEncoder.encode('world!');
    const readableStream = new PonyfillReadableStream({
      start(controller) {
        controller.enqueue(decodedHello);
        controller.enqueue(decodedWorld);
        controller.close();
      },
    });
    const chunks: string[] = [];
    const pipedStream = readableStream.pipeThrough(new PonyfillTextDecoderStream());
    const reader = pipedStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
    }
    expect(chunks.join('')).toBe('Hello, world!');
  });
  it('piped cancellation works', done => {
    expect.assertions(1);
    const readableStream = new PonyfillReadableStream({
      cancel(error) {
        expect(error).toBe('test error');
        done();
      },
    });
    const pipedStream = readableStream.pipeThrough(new PonyfillTextEncoderStream());
    pipedStream.cancel('test error').finally(() => {});
  });
});
