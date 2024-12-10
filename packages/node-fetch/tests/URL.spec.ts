import { PonyfillURL } from '../src/URL.js';

describe('URL', () => {
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
});
