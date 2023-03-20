import { PonyfillHeaders } from '../src/Headers.js';

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
});
