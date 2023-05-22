import { fetchPonyfill } from '../src/fetch.js';
import { PonyfillHeaders } from '../src/Headers.js';
import undici from 'undici';

describe('Headers', () => {
  it('be case-insensitive', () => {
    const headers = new PonyfillHeaders();
    headers.set('X-Header', 'foo');
    expect(headers.get('x-header')).toBe('foo');
    headers.append('x-HEADER', 'bar');
    expect(headers.get('X-HEADER')).toBe('foo, bar');
  });
  it('supports inputs with multiple values', () => {
    const headers = new PonyfillHeaders({
      'X-Header': ['foo', 'bar'],
    });
    expect(headers.get('x-header')).toBe('foo, bar');
  });
  describe('performance optimizations', () => {
    it('should not create a map if the input is an object and only getter is used', () => {
      const headers = new PonyfillHeaders({
        'X-Header': 'foo',
      });
      expect(headers.get('x-header')).toBe('foo');
      expect(headers['mapIsBuilt']).toBe(false);
    });
  });
  jest.setTimeout(60000);
  it('should respect custom header serializer', async () => {
    jest.spyOn(undici, 'request');
    const res = await fetchPonyfill(`https://httpbin.org/headers`, {
      headersSerializer() {
        return {
          'X-TesT': 'test',
          Accept: 'application/json',
        };
      },
    });
    expect(undici.request).toHaveBeenCalledWith(
      'https://httpbin.org/headers',
      expect.objectContaining({
        headers: {
          'X-TesT': 'test',
          Accept: 'application/json',
        },
      }),
    );
    expect(res.status).toBe(200);
    await res.text();
  });
});
