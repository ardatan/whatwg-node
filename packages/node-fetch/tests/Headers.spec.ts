import { inspect } from 'node:util';
import { describe, expect, it } from '@jest/globals';
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
  // TODO
  it.skip('should respect custom header serializer', async () => {
    const res = await fetchPonyfill(`${baseUrl}/headers`, {
      headersSerializer() {
        return ['X-Test: test', 'Accept: application/json'];
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      headers: {
        'X-Test': 'test',
        Accept: 'application/json',
      },
    });
  });
  it('should work with node.util.inspect', () => {
    const headers = new PonyfillHeaders();
    headers.set('X-Header', 'foo');
    expect(inspect(headers)).toBe("Headers { 'x-header': 'foo' }");
  });
  it('should iterate each set-cookie individually', () => {
    const headers = new PonyfillHeaders();
    headers.append('set-cookie', 'foo');
    headers.append('set-cookie', 'bar');
    const headerEntries: [string, string][] = [];
    headers.forEach((value, key) => {
      headerEntries.push([key, value]);
    });
    expect(headerEntries).toEqual([
      ['set-cookie', 'foo'],
      ['set-cookie', 'bar'],
    ]);
  });
  it('inspect correctly with null header values', () => {
    const headers = new PonyfillHeaders();
    headers.set('X-Header', null!);
    expect(inspect(headers)).toBe("Headers { 'x-header': null }");
  });
  describe('Set-Cookie', () => {
    it('handles values in the given map', () => {
      const init = {
        // Record<string, string[]> is not a HeadersInit actually
        'set-cookie': ['a=b', 'c=d'],
      } as any;
      const headers = new PonyfillHeaders(init);
      expect(headers.get('Set-Cookie')).toBe('a=b,c=d');
    });
  });
});
