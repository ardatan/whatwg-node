import { PonyfillRequest } from '../src/Request.js';

describe('Request', () => {
  it('should normalize the method name', () => {
    const req = new PonyfillRequest('http://a', { method: 'get' });
    expect(req.method).toBe('GET');
  });
});
