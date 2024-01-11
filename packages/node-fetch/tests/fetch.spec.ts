import { Readable } from 'stream';
import { runTestsForEachFetchImpl } from '../../server/test/test-fetch.js';
import { PonyfillBlob } from '../src/Blob.js';
import { fetchPonyfill } from '../src/fetch.js';
import { PonyfillFormData } from '../src/FormData.js';
import { PonyfillReadableStream } from '../src/ReadableStream.js';

describe('Node Fetch Ponyfill', () => {
  runTestsForEachFetchImpl(implementationName => {
    // const baseUrl = process.env.CI ? 'http://localhost:8888' : 'https://httpbin.org';
    const baseUrl = 'https://httpbin.org';
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
    // TODO: Remove .only on test before merging.
    // TODO: Remove console.logs before merging.
    it.only('should respect AbortSignal on a streamed response', async () => {
      console.log(`should respect AbortSignal on a streamed response (${implementationName})`);
      expect.assertions(1);
      const controller = new AbortController();
      const fetchPromise = fetchPonyfill(baseUrl + `/stream-bytes/${10 * 1024 * 1024 * 1024}`, {
        signal: controller.signal,
      });
      // NOTE: We have tried to reduce the time below 2 seconds, but when doing so it doesn't
      // appear that we always hit the streamed response abort code path.
      setTimeout(() => {
        console.log('Aborting');
        controller.abort();
      }, 2000);
      try {
        const response = await fetchPromise;
        if (!response || !response.body) {
          throw new Error('Response or response body is null');
        }
        for await (const chunk of response.body) {
          if (controller.signal.aborted) {
            console.log("Controller's signal is aborted");
            break;
          }
          console.log('Received chunk of size', chunk.length);
        }
        console.log('Done');
      } catch (err: any) {
        console.log(err);
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
    it('should load correctly', async () => {
      const response = await fetchPonyfill(
        'https://api.apis.guru/v2/specs/mashape.com/geodb/1.0.0/swagger.json',
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.swagger).toBe('2.0');
    });
  });
});
