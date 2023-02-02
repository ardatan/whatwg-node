import { globalAgent } from 'https';
import { Readable } from 'stream';
import { PonyfillAbortController } from '../src/AbortController';
import { PonyfillBlob } from '../src/Blob';
import { fetchPonyfill } from '../src/fetch';
import { PonyfillFormData } from '../src/FormData';
import { PonyfillReadableStream } from '../src/ReadableStream';

describe('Node Fetch Ponyfill', () => {
  afterAll(() => {
    globalAgent.destroy();
  })
  it('should fetch', async () => {
    const response = await fetchPonyfill('https://httpbin.org/get');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.url).toBe('https://httpbin.org/get');
  });
  it('should fetch with headers', async () => {
    const response = await fetchPonyfill('https://httpbin.org/headers', {
      headers: {
        'X-Test': 'test',
      },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.headers['X-Test']).toBe('test');
  });
  it('should follow redirects', async () => {
    const response = await fetchPonyfill('https://httpbin.org/redirect/1');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.url).toBe('https://httpbin.org/get');
    expect(response.redirected).toBe(true);
  });
  it('should not follow redirects', async () => {
    const response = await fetchPonyfill('https://httpbin.org/redirect/1', {
      redirect: 'manual',
    });
    expect(response.status).toBe(302);
    expect(response.url).toBe('https://httpbin.org/redirect/1');
    await response.text();
  });
  it('should fail if redirects are not allowed', async () => {
    await expect(
      fetchPonyfill('https://httpbin.org/redirect/1', {
        redirect: 'error',
      }),
    ).rejects.toThrow();
  });
  it('should accept string bodies', async () => {
    const response = await fetchPonyfill('https://httpbin.org/post', {
      method: 'POST',
      body: 'test',
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toBe('test');
  });
  it('should accept Buffer bodies', async () => {
    const response = await fetchPonyfill('https://httpbin.org/post', {
      method: 'POST',
      body: Buffer.from('test', 'utf-8'),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toBe('test');
  });
  it('should accept Readable bodies', async () => {
    const response = await fetchPonyfill('https://httpbin.org/post', {
      method: 'POST',
      body: Readable.from('test'),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toBe('test');
  });
  it('should accept ReadableStream bodies', async () => {
    const response = await fetchPonyfill('https://httpbin.org/post', {
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
    const response = await fetchPonyfill('https://httpbin.org/post', {
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
    const response = await fetchPonyfill('https://httpbin.org/post', {
      method: 'POST',
      body: formdata,
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.form.test).toBe('test');
    expect(body.files['test-file']).toBe('test-content');
  });
  it('should respect AbortSignal', async () => {
    const controller = new PonyfillAbortController();
    setTimeout(() => {
      controller.abort();
    }, 300);
    await expect(
      fetchPonyfill('https://httpbin.org/delay/5', {
        signal: controller.signal,
      }),
    ).rejects.toThrow('The operation was aborted.');
  });
});
