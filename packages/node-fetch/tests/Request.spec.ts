import { PonyfillRequest } from '../src/Request.js';

describe('Request', () => {
  it('should normalize the method name', () => {
    const req = new PonyfillRequest('http://a', { method: 'get' });
    expect(req.method).toBe('GET');
  });

  it('should instatitate PonyfillRequest from a Request correctly', () => {
    const req = new Request('http://a', { method: 'put', headers: { 'x-test': '1' } });

    const ponyReq = new PonyfillRequest(req);
    expect(ponyReq.method).toBe('PUT');
    expect(ponyReq.headers.get('x-test')).toBe('1');
  });

  it('should instatitate PonyfillRequest from another PonyfillRequest correctly', () => {
    const firstPony = new PonyfillRequest('http://a', {
      method: 'put',
      headers: { 'x-test': '1' },
    });

    const secondPony = new PonyfillRequest(firstPony);
    expect(secondPony.method).toBe('PUT');
    expect(secondPony.headers.get('x-test')).toBe('1');
  });
});
