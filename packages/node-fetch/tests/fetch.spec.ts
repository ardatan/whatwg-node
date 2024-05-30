import { Blob as NodeBlob } from 'buffer';
import { Readable } from 'stream';
import { URL as NodeURL } from 'url';
import { runTestsForEachFetchImpl } from '../../server/test/test-fetch.js';

describe('Node Fetch Ponyfill', () => {
  runTestsForEachFetchImpl(
    (
      _,
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
      it('should accept Readable bodies', async () => {
        const response = await fetchPonyfill(baseUrl + '/post', {
          method: 'POST',
          duplex: 'half',
          // @ts-expect-error Readable is not part of RequestInit type yet
          body: Readable.from(Buffer.from('test')),
        });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data).toBe('test');
      });
      it('should accept ReadableStream bodies', async () => {
        const response = await fetchPonyfill(baseUrl + '/post', {
          method: 'POST',
          body: new PonyfillReadableStream({
            start(controller) {
              controller.enqueue(Buffer.from('test'));
              controller.close();
            },
          }),
          // @ts-expect-error duplex is not part of RequestInit type yet
          duplex: 'half',
        });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data).toBe('test');
      });
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
      it('should respect AbortSignal', async () => {
        await expect(
          fetchPonyfill(baseUrl + '/delay/5', {
            signal: AbortSignal.timeout(1000),
          }),
        ).rejects.toThrow('aborted');
      });
      it('should respect AbortSignal on a streamed response', async () => {
        expect.assertions(1);
        const controller = new AbortController();
        const fetchPromise = fetchPonyfill(baseUrl + `/stream-bytes/${10 * 1024 * 1024 * 1024}`, {
          signal: controller.signal,
        });
        try {
          const response = await fetchPromise;
          if (!response || !response.body) {
            throw new Error('Response or response body is null');
          }
          let cnt = 0;
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
      });
      it('should respect gzip', async () => {
        const response = await fetchPonyfill(baseUrl + '/gzip');
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.gzipped).toBe(true);
      });
      it('should respect deflate', async () => {
        const response = await fetchPonyfill(baseUrl + '/deflate');
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.deflated).toBe(true);
      });
      it('should respect brotli', async () => {
        const response = await fetchPonyfill(baseUrl + '/brotli');
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.brotli).toBe(true);
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
        expect(response.headers.get('content-type')).toBe('application/json');
        expect(response.headers.get('content-length')).toBe('15');
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
        expect(response.headers.get('content-type')).toBe('application/json');
        expect(response.headers.get('content-length')).toBe('15');
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
        expect(response.headers.get('content-type')).toBe('application/json');
        expect(response.headers.get('content-length')).toBe('15');
        const resJson = await response.json();
        expect(resJson.test).toBe('test');
      });
    },
    { noNativeFetch: true },
  );
});
