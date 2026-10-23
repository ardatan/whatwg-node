import { Readable } from 'node:stream';
import { describe, expect, it } from '@jest/globals';
import { ContentLengthMismatchError } from '../src/ContentLengthMismatchError.js';
import { PonyfillReadableStream } from '../src/ReadableStream.js';
import { PonyfillRequest } from '../src/Request.js';

describe('Content-Length mismatch enforcement', () => {
  it('rejects as soon as a streamed body exceeds Content-Length', async () => {
    const encoder = new TextEncoder();
    const delivered: string[] = [];
    const stream = Readable.from([encoder.encode('hello'), encoder.encode(' world')]);

    const request = new PonyfillRequest('http://localhost/test', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        'content-length': '5',
      },
      body: stream,
      duplex: 'half',
    });

    const reader = request.body!.getReader();
    await expect(
      (async () => {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          delivered.push(Buffer.from(value).toString('utf8'));
        }
      })(),
    ).rejects.toThrow(ContentLengthMismatchError);

    // Excess bytes must never be delivered to the consumer.
    expect(delivered.join('')).not.toContain('world');
  });

  it('rejects when the body ends before Content-Length bytes', async () => {
    const request = new PonyfillRequest('http://localhost/test', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        'content-length': '100',
      },
      body: 'short',
    });

    await expect(request.text()).rejects.toThrow(ContentLengthMismatchError);
  });

  it('allows a body whose length matches Content-Length', async () => {
    const request = new PonyfillRequest('http://localhost/test', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        'content-length': '5',
      },
      body: 'hello',
    });

    await expect(request.text()).resolves.toBe('hello');
  });

  it('does not enforce when Content-Length is absent', async () => {
    const encoder = new TextEncoder();
    const stream = new PonyfillReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('any length is fine'));
        controller.close();
      },
    });

    const request = new PonyfillRequest('http://localhost/test', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: stream,
      duplex: 'half',
    });

    await expect(request.text()).resolves.toBe('any length is fine');
  });

  it('rejects a buffered body that is larger than Content-Length without streaming', async () => {
    const large = Buffer.alloc(1024, 0x61);
    const request = new PonyfillRequest('http://localhost/test', {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        'content-length': '10',
      },
      body: large,
    });

    await expect(request.arrayBuffer()).rejects.toThrow(ContentLengthMismatchError);
  });

  it('rejects a streamed body via text() by counting chunks (no raw .body access)', async () => {
    const encoder = new TextEncoder();
    const stream = Readable.from([encoder.encode('hello'), encoder.encode(' world')]);

    const request = new PonyfillRequest('http://localhost/test', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        'content-length': '5',
      },
      body: stream,
      duplex: 'half',
    });

    await expect(request.text()).rejects.toThrow(ContentLengthMismatchError);
  });

  it('rejects when a single chunk is larger than Content-Length without delivering it', async () => {
    const encoder = new TextEncoder();
    const delivered: string[] = [];
    const stream = Readable.from([encoder.encode('this is way too long')]);

    const request = new PonyfillRequest('http://localhost/test', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        'content-length': '5',
      },
      body: stream,
      duplex: 'half',
    });

    const reader = request.body!.getReader();
    await expect(
      (async () => {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          delivered.push(Buffer.from(value).toString('utf8'));
        }
      })(),
    ).rejects.toThrow(ContentLengthMismatchError);

    expect(delivered).toEqual([]);
  });
});
