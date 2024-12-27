import { PonyfillURL } from '../src/URL.js';

describe('URL', () => {
  const urlExamples = [
    'https://example.com/?foo=bar&bar=qux',
    'http://[::1]:8080',
    'http://localhost:8080?foo=bar',
  ];
  for (const urlExample of urlExamples) {
    describe(urlExample, () => {
      it('should parse and stringify URLs', () => {
        const url = new PonyfillURL(urlExample);
        expect(url.toString()).toBe(urlExample.replace('8080', '8080/'));
      });
      it('should parse the URLs as expected', () => {
        const ponyfillUrl = new PonyfillURL(urlExample);
        const nativeUrl = new URL(urlExample);
        expect(ponyfillUrl.toString() || null).toBe(nativeUrl.toString() || null);
        expect(ponyfillUrl.protocol || null).toBe(nativeUrl.protocol || null);
        expect(ponyfillUrl.host || null).toBe(nativeUrl.host || null);
        expect(ponyfillUrl.hostname || null).toBe(nativeUrl.hostname || null);
        expect(ponyfillUrl.port || null).toBe(nativeUrl.port || null);
        expect(ponyfillUrl.pathname || null).toBe(nativeUrl.pathname || null);
        expect(ponyfillUrl.search || null).toBe(nativeUrl.search || null);
        ponyfillUrl.searchParams.forEach((value, key) => {
          expect(nativeUrl.searchParams.get(key) || null).toBe(value || null);
        });
        expect(ponyfillUrl.username || null).toBe(nativeUrl.username || null);
        expect(ponyfillUrl.password || null).toBe(nativeUrl.password || null);
        expect(ponyfillUrl.origin || null).toBe(nativeUrl.origin || null);
      });
    });
  }
  it('should parse search params', () => {
    const url = new PonyfillURL('https://example.com/?foo=bar&foo=baz&bar=qux');
    expect(url.searchParams.get('foo')).toBe('bar');
    expect(url.searchParams.getAll('foo')).toEqual(['bar', 'baz']);
    expect(url.searchParams.get('bar')).toBe('qux');
    expect(url.searchParams.getAll('bar')).toEqual(['qux']);
    expect(url.searchParams.get('baz')).toBeNull();
    expect(url.searchParams.getAll('baz')).toEqual([]);
  });
  it('should update search params', () => {
    const url = new PonyfillURL('https://example.com/?foo=bar&foo=baz&bar=qux');
    url.searchParams.set('foo', 'qux');
    url.searchParams.delete('baz');
    expect(url.toString()).toBe('https://example.com/?foo=qux&bar=qux');
  });
  it('parses ipv6 hosts', () => {
    const url = new PonyfillURL('http://[::1]:8000');
    expect(url.host).toBe('[::1]:8000');
    expect(url.hostname).toBe('[::1]');
    expect(url.port).toBe('8000');
  });
  it('parses query strings with ports without pathname', () => {
    const url = new PonyfillURL('http://localhost:8080?foo=bar');
    expect(url.host).toBe('localhost:8080');
    expect(url.hostname).toBe('localhost');
    expect(url.pathname).toBe('/');
    expect(url.port).toBe('8080');
    expect(url.search).toBe('?foo=bar');
  });
});
