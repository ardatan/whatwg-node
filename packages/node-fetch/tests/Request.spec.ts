import { Agent, createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { describe, expect, it } from '@jest/globals';
import { fetchPonyfill } from '../src/fetch.js';
import { PonyfillRequest } from '../src/Request.js';

const skipIf = (condition: boolean) => (condition ? it.skip : it);

describe('Request', () => {
  it('should normalize the method name', () => {
    const req = new PonyfillRequest('http://a', { method: 'get' });
    expect(req.method).toBe('GET');
  });

  skipIf(!!globalThis.Deno)(
    'should instatitate PonyfillRequest from a Request correctly',
    async () => {
      const req = new Request('http://a', {
        method: 'put',
        headers: { 'x-test': '1' },
        body: 'test',
      });

      const ponyReq = new PonyfillRequest(req);
      expect(ponyReq.method).toBe('PUT');
      expect(ponyReq.headers.get('x-test')).toBe('1');
      expect(await ponyReq.text()).toBe('test');
    },
  );

  it('should instatitate PonyfillRequest from another PonyfillRequest correctly', async () => {
    const firstPony = new PonyfillRequest('http://a', {
      method: 'put',
      headers: { 'x-test': '1' },
      body: 'test',
    });

    const secondPony = new PonyfillRequest(firstPony);
    expect(secondPony.method).toBe('PUT');
    expect(secondPony.headers.get('x-test')).toBe('1');
    expect(await secondPony.text()).toBe('test');
  });

  it('should keep the input request properties that init does not set', async () => {
    const createRequest = () =>
      new PonyfillRequest('http://a', {
        method: 'post',
        headers: { 'x-test': '1' },
        body: 'payload',
      });

    const copy = new PonyfillRequest(createRequest(), {});
    expect(copy.method).toBe('POST');
    expect(copy.headers.get('x-test')).toBe('1');
    expect(await copy.text()).toBe('payload');

    const withHeaders = new PonyfillRequest(createRequest(), { headers: { 'x-other': '2' } });
    expect(withHeaders.method).toBe('POST');
    expect(withHeaders.headers.get('x-test')).toBeNull();
    expect(withHeaders.headers.get('x-other')).toBe('2');
    expect(await withHeaders.text()).toBe('payload');
  });

  it('should keep the input request signal when init does not set one', () => {
    const controller = new AbortController();
    const original = new PonyfillRequest('http://a', { signal: controller.signal });
    const copy = new PonyfillRequest(original, { method: 'POST' });
    controller.abort();
    expect(copy.signal.aborted).toBe(true);
  });

  it('should recompute Content-Length when init replaces the body', async () => {
    const original = new PonyfillRequest('http://a', { method: 'POST', body: 'payload' });
    const copy = new PonyfillRequest(original, { body: 'a much longer body' });
    expect(copy.headers.get('content-length')).toBe('18');

    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => res.end(Buffer.concat(chunks)));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const { port } = server.address() as AddressInfo;
      const sent = new PonyfillRequest(
        new PonyfillRequest(`http://127.0.0.1:${port}`, { method: 'POST', body: 'payload' }),
        { body: 'a much longer body' },
      );
      const res = await fetchPonyfill(sent);
      expect(await res.text()).toBe('a much longer body');
    } finally {
      server.close();
    }
  });

  it('should keep the input request body when init.body is null', async () => {
    const original = new PonyfillRequest('http://a', { method: 'POST', body: 'payload' });
    const copy = new PonyfillRequest(original, { body: null });
    expect(await copy.text()).toBe('payload');
  });

  it('should not inherit a body into a GET request', () => {
    const original = new PonyfillRequest('http://a', { method: 'POST', body: 'payload' });
    const copy = new PonyfillRequest(original, { method: 'GET' });
    expect(copy.body).toBeNull();
    expect(copy.headers.get('content-length')).toBeNull();
  });

  it('should not share headers with the input request', () => {
    const original = new PonyfillRequest('http://a', { headers: { 'x-test': '1' } });
    const copy = new PonyfillRequest(original, { method: 'PUT' });
    copy.headers.set('x-other', '2');
    expect(original.headers.get('x-other')).toBeNull();
    expect(copy.headers.get('x-test')).toBe('1');
  });

  it('should allow agent as RequestInfo and RequestInit', async () => {
    const agent = new Agent();
    const firstPony = new PonyfillRequest('http://a', {
      agent,
    });
    const secondPony = new PonyfillRequest(firstPony);
    expect(firstPony.agent).toBe(agent);
    expect(secondPony.agent).toBe(agent);
  });
});
