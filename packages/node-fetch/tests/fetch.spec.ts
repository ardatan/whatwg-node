import { Buffer, Blob as NodeBlob } from 'node:buffer';
import { Readable } from 'node:stream';
import { setTimeout } from 'node:timers/promises';
import { URL as NodeURL } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { runTestsForEachFetchImpl } from '../../server/test/test-fetch.js';

function testIf(condition: boolean, name: string, fn: () => void) {
  return condition ? it(name, fn) : it.skip(name, fn);
}

describe('Node Fetch Ponyfill', () => {
  runTestsForEachFetchImpl(
    (
      implName,
      {
        fetchAPI: {
          fetch: fetchPonyfill,
          URL: PonyfillURL,
          ReadableStream: PonyfillReadableStream,
          FormData: PonyfillFormData,
          Blob: PonyfillBlob,
        },
      },
    ) => {
      const baseUrl = process.env.CI ? 'http://localhost:8888' : 'https://httpbin.org';
      it('should fetch', async () => {
        const response = await fetchPonyfill(baseUrl + '/get');
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.url).toBe(baseUrl + '/get');
      });
      it('should fetch with headers', async () => {
        const response = await fetchPonyfill(baseUrl + '/headers', {
          headers: {
            'X-Test': 'test',
          },
        });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.headers['X-Test']).toBe('test');
      });
      it('should follow redirects', async () => {
        const response = await fetchPonyfill(baseUrl + '/redirect/1');
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.url).toBe(baseUrl + '/get');
        // expect(response.redirected).toBe(true);
      });
      it('should not follow redirects', async () => {
        const response = await fetchPonyfill(baseUrl + '/redirect/1', {
          redirect: 'manual',
        });
        expect(response.status).toBe(302);
        expect(response.url).toBe(baseUrl + '/redirect/1');
        await response.text();
      });
      it('should fail if redirects are not allowed', async () => {
        await expect(
          fetchPonyfill(baseUrl + '/redirect/1', {
            redirect: 'error',
          }),
        ).rejects.toThrow();
      });
      it('should accept string bodies', async () => {
        const response = await fetchPonyfill(baseUrl + '/post', {
          method: 'POST',
          body: 'test',
        });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data).toBe('test');
      });
      it('should accept Buffer bodies', async () => {
        const response = await fetchPonyfill(baseUrl + '/post', {
          method: 'POST',
          body: Buffer.from('test', 'utf-8'),
        });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data).toBe('test');
      });
      // Deno does not support Node.js streams as RequestInit.body yet
      testIf(
        !globalThis.Deno && (globalThis.Bun ? implName !== 'native' : true),
        'should accept Readable bodies',
        async () => {
          const response = await fetchPonyfill(baseUrl + '/post', {
            method: 'POST',
            duplex: 'half',
            // @ts-expect-error Readable is not part of RequestInit type yet
            body: Readable.from(Buffer.from('test')),
          });
          expect(response.status).toBe(200);
          const body = await response.json();
          expect(body.data).toBe('test');
        },
      );
      // Bun does not support ReadableStream in fetch yet
      testIf(
        globalThis.Bun ? implName !== 'native' : true,
        'should accept ReadableStream bodies',
        async () => {
          const response = await fetchPonyfill(baseUrl + '/post', {
            method: 'POST',
            body: new PonyfillReadableStream({
              async start(controller) {
                await setTimeout(100);
                controller.enqueue(Buffer.from('test'));
                await setTimeout(100);
                controller.close();
              },
            }),
            // @ts-expect-error duplex is not part of RequestInit type yet
            duplex: 'half',
          });
          expect(response.status).toBe(200);
          const body = await response.json();
          expect(body.data).toBe('test');
        },
      );
      it('should accept Blob bodies', async () => {
        const response = await fetchPonyfill(baseUrl + '/post', {
          method: 'POST',
          body: new PonyfillBlob(['test']),
        });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data).toBe('test');
      });
      it('should accept FormData bodies', async () => {
        const formdata = new PonyfillFormData();
        formdata.append('test', 'test');
        formdata.append(
          'test-file',
          new PonyfillBlob(['test-content'], { type: 'text/plain' }),
          'test.txt',
        );
        const response = await fetchPonyfill(baseUrl + '/post', {
          method: 'POST',
          body: formdata,
        });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.form.test).toBe('test');
        expect(body.files['test-file']).toBe('test-content');
      });
      it('should respect AbortSignal', () => {
        return expect(
          fetchPonyfill(baseUrl + '/delay/3', {
            signal: AbortSignal.timeout(1000),
          }),
        ).rejects.toThrow();
      });
      it('should respect AbortSignal on a streamed response', async () => {
        expect.assertions(2);
        const controller = new AbortController();
        const fetchPromise = fetchPonyfill(baseUrl + `/stream-bytes/${10 * 1024 * 1024 * 1024}`, {
          signal: controller.signal,
        });
        let cnt = 0;
        try {
          const response = await fetchPromise;
          if (!response || !response.body) {
            throw new Error('Response or response body is null');
          }
          // @ts-expect-error ReadableStream is an AsyncIterable but types are not updated yet
          for await (const _ of response.body) {
            if (controller.signal.aborted) {
              throw new Error('aborted but stream leaks');
            }
            cnt++;
            if (cnt === 4) {
              controller.abort();
            }
          }
        } catch (err: any) {
          expect(err.message).toMatch(/aborted/);
        }
        expect(cnt).toBe(4);
      });
      const describeIf = (condition: boolean) => (condition ? describe : describe.skip);
      // Deno does not uncompress responses automatically
      describeIf(!globalThis.Deno)('Compression', () => {
        it('should respect gzip', async () => {
          const response = await fetchPonyfill(baseUrl + '/gzip');
          expect(response.status).toBe(200);
          expect(response.headers.get('content-encoding')).toBe('gzip');
          const body = await response.json();
          expect(body.gzipped).toBe(true);
        });
        it('should respect deflate', async () => {
          const response = await fetchPonyfill(baseUrl + '/deflate');
          expect(response.status).toBe(200);
          expect(response.headers.get('content-encoding')).toBe('deflate');
          const body = await response.json();
          expect(body.deflated).toBe(true);
        });
        it('should respect brotli', async () => {
          const response = await fetchPonyfill(baseUrl + '/brotli');
          expect(response.status).toBe(200);
          expect(response.headers.get('content-encoding')).toBe('br');
          const body = await response.json();
          expect(body.brotli).toBe(true);
        });
      });
      it.skip('should load correctly', async () => {
        const response = await fetchPonyfill(
          'https://api.apis.guru/v2/specs/mashape.com/geodb/1.0.0/swagger.json',
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.swagger).toBe('2.0');
      });
      it('should handle object urls for PonyfillBlob', async () => {
        const testJsonBlob = new PonyfillBlob([JSON.stringify({ test: 'test' })], {
          type: 'application/json',
        });
        const objectUrl = PonyfillURL.createObjectURL(testJsonBlob);
        const response = await fetchPonyfill(objectUrl);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('application/json');
        // expect(response.headers.get('content-length')).toBe('15');
        const resJson = await response.json();
        expect(resJson.test).toBe('test');
      });
      it('should handle object urls for global Blob', async () => {
        const testJsonBlob = new globalThis.Blob([JSON.stringify({ test: 'test' })], {
          type: 'application/json',
        });
        const objectUrl = URL.createObjectURL(testJsonBlob);
        const response = await fetchPonyfill(objectUrl);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('application/json');
        // expect(response.headers.get('content-length')).toBe('15');
        const resJson = await response.json();
        expect(resJson.test).toBe('test');
      });
      it('should handle object urls for Node.js Blob', async () => {
        const testJsonBlob = new NodeBlob([JSON.stringify({ test: 'test' })], {
          type: 'application/json',
        });
        const objectUrl = NodeURL.createObjectURL(testJsonBlob);
        const response = await fetchPonyfill(objectUrl);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('application/json');
        // expect(response.headers.get('content-length')).toBe('15');
        const resJson = await response.json();
        expect(resJson.test).toBe('test');
      });
      // No need to test this on Deno
      testIf(!globalThis.Deno, 'handles redirect from http to https', async () => {
        const response = await fetchPonyfill('http://github.com');
        await response.text();
        expect(response.status).toBe(200);
        expect(response.url === 'https://github.com' || response.redirected).toBeTruthy();
      });
      it('does not leak when signal is not used', async () => {
        const res = await fetchPonyfill(baseUrl, { signal: new AbortController().signal });
        await res.text();
      });
      it('does not leak when timeout signal is not used', async () => {
        const res = await fetchPonyfill(baseUrl, { signal: AbortSignal.timeout(10_000) });
        await res.text();
      });
    },
  );
});
