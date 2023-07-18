import { inspect } from 'util';
import { fetchPonyfill } from '../src/fetch.js';
import { PonyfillHeaders } from '../src/Headers.js';

describe('Headers', () => {
  const baseUrl = process.env.CI ? 'http://localhost:8888' : 'https://httpbin.org';
  it('be case-insensitive', () => {
    const headers = new PonyfillHeaders();
    headers.set('X-Header', 'foo');
    expect(headers.get('x-header')).toBe('foo');
    headers.append('x-HEADER', 'bar');
    expect(headers.get('X-HEADER')).toBe('foo, bar');
  });
  describe('performance optimizations', () => {
    it('should not create a map if the input is an object and only getter is used', () => {
      const headersInit = {
        'X-Header': 'foo',
      };
      const headers = new PonyfillHeaders(headersInit);
      headersInit['X-Header'] = 'bar';
      expect(headers.get('x-header')).toBe('bar');
    });
  });
  it('should respect custom header serializer', async () => {
    const res = await fetchPonyfill(`${baseUrl}/headers`, {
      headersSerializer() {
        return ['X-TesT', 'test', 'Accept', 'application/json'];
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      headers: {
        'X-TesT': 'test',
        Accept: 'application/json',
      },
    });
  });
  it('should work with node.util.inspect', () => {
    const headers = new PonyfillHeaders();
    headers.set('X-Header', 'foo');
    expect(inspect(headers)).toBe("Headers { 'x-header': 'foo' }");
  });
});
