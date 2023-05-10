import { Response } from '@whatwg-node/fetch';
import { createServerAdapter } from '@whatwg-node/server';
import { useCookies } from '../src/useCookies.js';

describe('Cookie Management', () => {
  it('should receive a cookie', async () => {
    const serverAdapter = createServerAdapter(
      async request => {
        const fooCookie = await request.cookieStore?.get('foo');
        return Response.json({ foo: fooCookie?.value });
      },
      {
        plugins: [useCookies()],
      },
    );
    const response = await serverAdapter.fetch('/', {
      headers: {
        cookie: 'foo=bar',
      },
    });
    const json = await response.json();
    expect(json).toMatchObject({ foo: 'bar' });
  });
  it('should set a cookie', async () => {
    const serverAdapter = createServerAdapter(
      async request => {
        await request.cookieStore?.set('foo', 'bar');
        return new Response('OK');
      },
      {
        plugins: [useCookies()],
      },
    );
    const response = await serverAdapter.fetch('/');
    await response.text();
    expect(response.headers.get('set-cookie')).toContain('foo=bar');
  });
  it('should set a cookie with options', async () => {
    const serverAdapter = createServerAdapter(
      async request => {
        await request.cookieStore?.set({
          name: 'foo',
          value: 'bar',
          expires: 1000,
          path: '/foo',
          domain: 'foo.com',
          secure: true,
          sameSite: 'lax',
        });
        return new Response('OK');
      },
      {
        plugins: [useCookies()],
      },
    );
    const response = await serverAdapter.fetch('/');
    await response.text();
    expect(response.headers.get('set-cookie')).toContain(
      'Domain=foo.com; Path=/foo; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Secure; SameSite=Lax',
    );
  });
  it('should delete a cookie', async () => {
    const serverAdapter = createServerAdapter(
      async request => {
        await request.cookieStore?.delete('foo');
        return new Response('OK');
      },
      {
        plugins: [useCookies()],
      },
    );
    const response = await serverAdapter.fetch('/');
    await response.text();
    expect(response.headers.get('set-cookie')).toContain(
      'foo=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    );
  });
  it('should change a cookie', async () => {
    const serverAdapter = createServerAdapter(
      async request => {
        await request.cookieStore?.set('foo', 'baz');
        return new Response('OK');
      },
      {
        plugins: [useCookies()],
      },
    );
    const response = await serverAdapter.fetch('/', {
      headers: {
        cookie: 'foo=bar',
      },
    });
    await response.text();
    expect(response.headers.get('set-cookie')).toContain('foo=baz');
  });
  it('should set multiple cookies', async () => {
    const serverAdapter = createServerAdapter(
      async request => {
        await request.cookieStore?.set('foo', 'bar');
        await request.cookieStore?.set('baz', 'qux');
        return new Response('OK');
      },
      {
        plugins: [useCookies()],
      },
    );
    const response = await serverAdapter.fetch('/');
    await response.text();
    const setCookies = response.headers.get('set-cookie');
    expect(setCookies).toContain('foo=bar');
    expect(setCookies).toContain('baz=qux');
  });
  it('should not set set-cookie header if no cookie is set', async () => {
    const serverAdapter = createServerAdapter(
      () => {
        return new Response('OK');
      }
    );
    const response = await serverAdapter.fetch('/');
    await response.text();
    expect(response.headers.get('set-cookie')).toBeNull();
  })
});
