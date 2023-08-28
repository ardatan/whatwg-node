import { Readable } from 'stream';
import { runTestsForEachFetchImpl } from '../../server/test/test-fetch.js';
import { PonyfillBlob } from '../src/Blob.js';
import { fetchPonyfill } from '../src/fetch.js';
import { PonyfillFormData } from '../src/FormData.js';
import { PonyfillReadableStream } from '../src/ReadableStream.js';

describe('Node Fetch Ponyfill', () => {
  runTestsForEachFetchImpl(() => {
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
    it.only('should accept FormData bodies', async () => {
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
  });
});
