import { Agent } from 'node:http';
import { describe, expect, it } from '@jest/globals';
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
