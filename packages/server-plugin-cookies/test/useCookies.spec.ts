import { runTestsForEachFetchImpl } from '../../server/test/test-fetch.js';
import { useCookies } from '../src/useCookies.js';

describe('Cookie Management', () => {
  runTestsForEachFetchImpl((_, { createServerAdapter, fetchAPI: { Response } }) => {
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
      const response = await serverAdapter.fetch('http://localhost', {
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
      const response = await serverAdapter.fetch('http://localhost');
      await response.text();
      expect(response.headers.getSetCookie?.()).toMatchInlineSnapshot(`
      [
        "foo=bar; Path=/; SameSite=Strict",
      ]
    `);
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
      const response = await serverAdapter.fetch('http://localhost');
      await response.text();
      expect(response.headers.getSetCookie?.()).toMatchInlineSnapshot(`
      [
        "foo=bar; Domain=foo.com; Path=/foo; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Secure; SameSite=Lax",
      ]
    `);
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
      const response = await serverAdapter.fetch('http://localhost');
      await response.text();
      expect(response.headers.getSetCookie?.()).toMatchInlineSnapshot(`
      [
        "foo=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict",
      ]
    `);
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
      const response = await serverAdapter.fetch('http://localhost', {
        headers: {
          cookie: 'foo=bar',
        },
      });
      await response.text();
      expect(response.headers.getSetCookie?.()).toMatchInlineSnapshot(`
      [
        "foo=baz; Path=/; SameSite=Strict",
      ]
    `);
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
      const response = await serverAdapter.fetch('http://localhost');
      await response.text();
      expect(response.headers.getSetCookie?.()).toMatchInlineSnapshot(`
      [
        "foo=bar; Path=/; SameSite=Strict",
        "baz=qux; Path=/; SameSite=Strict",
      ]
    `);
    });
    it('should not set set-cookie header if no cookie is set', async () => {
      const serverAdapter = createServerAdapter(() => {
        return new Response('OK');
      });
      const response = await serverAdapter.fetch('http://localhost');
      await response.text();
      expect(response.headers.getSetCookie?.()).toMatchInlineSnapshot(`[]`);
    });
  });
});
