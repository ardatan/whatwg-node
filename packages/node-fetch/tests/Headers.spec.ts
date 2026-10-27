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
    it('handles values in the given map for get method', () => {
      const headers = new PonyfillHeaders([
        ['set-cookie', 'a=b'],
        ['set-cookie', 'c=d'],
      ]);
      expect(headers.get('Set-Cookie')).toBe('a=b, c=d');
    });
    it('handles values in the given map for getSetCookie method', () => {
      const headers = new PonyfillHeaders([
        ['set-cookie', 'a=b'],
        ['set-cookie', 'c=d'],
      ]);
      expect(headers.getSetCookie()).toEqual(['a=b', 'c=d']);
    });
  });
  describe('sequence with a repeated name', () => {
    const init = (): [string, string][] => [
      ['Link', '<a>'],
      ['link', '<b>'],
      ['x-single', 'c'],
    ];
    it('keeps every value when another header is changed', () => {
      const appended = new PonyfillHeaders(init());
      appended.append('x-other', 'd');
      expect(appended.get('link')).toBe('<a>, <b>');
      const deleted = new PonyfillHeaders(init());
      deleted.delete('x-single');
      expect(deleted.get('link')).toBe('<a>, <b>');
    });
    it('replaces every value on set', () => {
      const headers = new PonyfillHeaders(init());
      headers.set('LINK', '<c>');
      expect(headers.get('link')).toBe('<c>');
      expect([...headers]).toEqual([
        ['link', '<c>'],
        ['x-single', 'c'],
      ]);
    });
    it('iterates the combined values', () => {
      const headers = new PonyfillHeaders([
        ...init(),
        ['set-cookie', 'a=b'],
        ['Set-Cookie', 'c=d'],
      ]);
      const expected = [
        ['link', '<a>, <b>'],
        ['set-cookie', 'a=b'],
        ['set-cookie', 'c=d'],
        ['x-single', 'c'],
      ];
      expect([...headers.entries()]).toEqual(expected);
      expect([...headers.keys()]).toEqual(['link', 'set-cookie', 'set-cookie', 'x-single']);
      expect([...headers.values()]).toEqual(['<a>, <b>', 'a=b', 'c=d', 'c']);
      const forEachEntries: [string, string][] = [];
      headers.forEach((value, key) => {
        forEachEntries.push([key, value]);
      });
      expect(forEachEntries).toEqual(expected);
    });
    it('keeps empty values when combining and after iteration', () => {
      const combined = new PonyfillHeaders([
        ['link', ''],
        ['link', '<b>'],
      ]);
      expect(combined.get('link')).toBe(', <b>');
      expect([...combined]).toEqual([['link', ', <b>']]);
      expect(combined.get('link')).toBe(', <b>');

      const empty = new PonyfillHeaders([['x-empty', '']]);
      expect(empty.get('x-empty')).toBe('');
      expect(empty.has('x-empty')).toBe(true);
      expect([...empty]).toEqual([['x-empty', '']]);
      expect(empty.get('x-empty')).toBe('');
      expect(empty.has('x-empty')).toBe(true);
    });
    it('iterates combined values in sorted order', () => {
      const headers = new PonyfillHeaders([
        ['2', 'a'],
        ['1', 'b'],
        ['2', 'b'],
      ]);
      expect([...headers]).toEqual([
        ['1', 'b'],
        ['2', 'a, b'],
      ]);
    });
    it('iterates object-backed headers with appended cookies and case collisions', () => {
      const headers = new PonyfillHeaders({
        'X-Test': 'a',
        'x-test': 'b',
        z: '1',
      } as Record<string, string>);
      headers.append('set-cookie', 'a=1');
      headers.append('set-cookie', 'b=2');
      expect([...headers]).toEqual([
        ['set-cookie', 'a=1'],
        ['set-cookie', 'b=2'],
        ['x-test', 'a, b'],
        ['z', '1'],
      ]);
    });
    it('skips headers deleted during forEach', () => {
      const headers = new PonyfillHeaders([
        ['a', '1'],
        ['b', '2'],
        ['c', '3'],
      ]);
      const seen: string[] = [];
      headers.forEach((_value, key) => {
        seen.push(key);
        if (key === 'a') {
          headers.delete('c');
        }
      });
      expect(seen).toEqual(['a', 'b']);
    });
    it('keeps set-cookie mutations after a later map build', () => {
      const replaced = new PonyfillHeaders([
        ['set-cookie', 'a=1'],
        ['set-cookie', 'b=2'],
        ['x', '1'],
      ]);
      replaced.set('set-cookie', 'c=3');
      expect(replaced.getSetCookie()).toEqual(['c=3']);
      expect([...replaced.entries()]).toEqual([
        ['set-cookie', 'c=3'],
        ['x', '1'],
      ]);

      const deleted = new PonyfillHeaders([
        ['set-cookie', 'a=1'],
        ['set-cookie', 'b=2'],
      ]);
      deleted.delete('set-cookie');
      expect(deleted.getSetCookie()).toEqual([]);
      expect([...deleted.entries()]).toEqual([]);

      const appended = new PonyfillHeaders([['set-cookie', 'a=1']]);
      appended.append('set-cookie', 'b=2');
      expect(appended.getSetCookie()).toEqual(['a=1', 'b=2']);
      expect([...appended.entries()]).toEqual([
        ['set-cookie', 'a=1'],
        ['set-cookie', 'b=2'],
      ]);
    });
  });
});
