import { Buffer } from 'node:buffer';
import { describe, expect, it } from '@jest/globals';
import { runTestsForEachFetchImpl } from '../../server/test/test-fetch';

describe('TextEncoderDecoderStream', () => {
  runTestsForEachFetchImpl(
    (_, { fetchAPI }) => {
      it('TextEncoderStream', async () => {
        const readableStream = new fetchAPI.ReadableStream({
          start(controller) {
            controller.enqueue(Buffer.from('Hello, '));
            controller.enqueue(Buffer.from('world!'));
            controller.close();
          },
        });
        const pipedStream = readableStream.pipeThrough(new fetchAPI.TextEncoderStream());
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
        const textEncoder = new fetchAPI.TextEncoder();
        const decodedHello = textEncoder.encode('Hello, ');
        const decodedWorld = textEncoder.encode('world!');
        const readableStream = new fetchAPI.ReadableStream({
          start(controller) {
            controller.enqueue(decodedHello);
            controller.enqueue(decodedWorld);
            controller.close();
          },
        });
        const chunks: string[] = [];
        const pipedStream = readableStream.pipeThrough(new fetchAPI.TextDecoderStream());
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
      it('piped cancellation works', async () => {
        const expectedError = new Error('test error');
        const thrownError = await new Promise<void>(resolve =>
          new fetchAPI.ReadableStream({
            cancel: resolve,
          })
            .pipeThrough(new fetchAPI.TextEncoderStream())
            .cancel(expectedError)
            .then(
              () => {},
              () => {},
            ),
        );
        expect(thrownError).toBe(expectedError);
      });
    },
    { noLibCurl: true },
  );
});
