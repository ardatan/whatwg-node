import { describe, expect, it } from '@jest/globals';
import { getCookieString } from '@whatwg-node/cookie-store';

describe('getCookieString helper', () => {
  const baseOptions = {
    name: 'foo',
    value: 'bar',
  };

  it('should work with just name and value', () => {
    expect(getCookieString(baseOptions)).toBe(`foo=bar`);
  });

  it('should work with a domain', () => {
    expect(
      getCookieString({
        ...baseOptions,
        domain: 'example.com',
      }),
    ).toBe(`foo=bar; Domain=example.com`);
  });

  it('should work with a path', () => {
    expect(
      getCookieString({
        ...baseOptions,
        path: '/',
      }),
    ).toBe(`foo=bar; Path=/`);
  });

  it('should work with a expires number', () => {
    expect(
      getCookieString({
        ...baseOptions,
        expires: 1687492800 * 1000,
      }),
    ).toBe(`foo=bar; Expires=Fri, 23 Jun 2023 04:00:00 GMT`);
  });

  it('should work with a expires Date', () => {
    expect(
      getCookieString({
        ...baseOptions,
        domain: null,
        expires: new Date(1687492800 * 1000),
      }),
    ).toBe(`foo=bar; Expires=Fri, 23 Jun 2023 04:00:00 GMT`);
  });

  it('should work with Secure', () => {
    expect(
      getCookieString({
        ...baseOptions,
        secure: true,
      }),
    ).toBe(`foo=bar; Secure; SameSite=Lax`);
  });

  it('Should preserve samesite when secure = true', () => {
    expect(
      getCookieString({
        ...baseOptions,
        secure: true,
        sameSite: 'none',
      }),
    ).toBe(`foo=bar; Secure; SameSite=None`);
  });

  it('Should preserve samesite when secure = false', () => {
    expect(
      getCookieString({
        ...baseOptions,
        sameSite: 'none',
      }),
    ).toBe(`foo=bar; SameSite=None`);
  });

  it('should work with HttpOnly', () => {
    expect(
      getCookieString({
        ...baseOptions,
        httpOnly: true,
      }),
    ).toBe(`foo=bar; HttpOnly`);
  });
});
