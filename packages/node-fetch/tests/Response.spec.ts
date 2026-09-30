import { describe, expect, it } from '@jest/globals';
import { PonyfillResponse } from '../src/Response.js';

describe('Response.redirect', () => {
  it('returns an empty status text and a serialized Location', () => {
    for (const status of [301, 302, 303, 307, 308]) {
      const response = PonyfillResponse.redirect('https://example.com', status);
      expect(response.status).toBe(status);
      expect(response.statusText).toBe('');
      expect(response.headers.get('Location')).toBe('https://example.com/');
    }
  });

  it('defaults the status to 302', () => {
    const response = PonyfillResponse.redirect('https://example.com/a');
    expect(response.status).toBe(302);
    expect(response.statusText).toBe('');
    expect(response.headers.get('Location')).toBe('https://example.com/a');
  });

  it('throws TypeError when the URL cannot be parsed', () => {
    expect(() => PonyfillResponse.redirect('http://:this is not a url')).toThrow(TypeError);
    expect(() => PonyfillResponse.redirect('/relative')).toThrow(TypeError);
  });

  it('throws RangeError when the status is not a redirect status', () => {
    for (const status of [200, 300, 309, 400, 500]) {
      expect(() => PonyfillResponse.redirect('https://example.com', status)).toThrow(RangeError);
    }
  });
});
