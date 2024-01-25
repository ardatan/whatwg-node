import { PonyfillRequest } from '../src/Request.js';

describe('Request', () => {
  it('should normalize the method name', () => {
    const req = new PonyfillRequest('http://a', { method: 'get' });
    expect(req.method).toBe('GET');
  });

  it('should instatitate PonyfillRequest from a Request correctly', async () => {
    const req = new Request('http://a', {
      method: 'put',
      headers: { 'x-test': '1' },
      body: 'test',
    });

    const ponyReq = new PonyfillRequest(req);
    expect(ponyReq.method).toBe('PUT');
    expect(ponyReq.headers.get('x-test')).toBe('1');
    expect(await ponyReq.text()).toBe('test');
  });

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
});
