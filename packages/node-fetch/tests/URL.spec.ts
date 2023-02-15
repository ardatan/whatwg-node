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
});
