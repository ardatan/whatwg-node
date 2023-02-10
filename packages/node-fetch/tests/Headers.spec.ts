import { PonyfillHeaders } from '../src/Headers';

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
    expect(headers.get('X-Header')).toBe('foo, bar');
  });
});
