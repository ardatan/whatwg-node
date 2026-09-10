import { describe, expect, it } from 'vitest';
import { createServerAdapter } from '../../server/src/createServerAdapter.js';
import { closeServer, listen, withBrowser } from '../../server/test/browser-utils.js';
import { useCookies } from '../src/useCookies.js';

describe('Cookies browser behavior', () => {
  it('sets a cookie the browser stores and sends back', async () => {
    const adapter = createServerAdapter(
      async request => {
        const url = new URL(request.url);
        if (url.pathname === '/set') {
          await request.cookieStore?.set({
            name: 'session',
            value: 'abc',
            path: '/',
            sameSite: 'lax',
            domain: null,
            expires: null,
          });
          return new Response('set', { headers: { 'content-type': 'text/plain' } });
        }
        if (url.pathname === '/read') {
          const session = await request.cookieStore?.get('session');
          return Response.json({ session: session?.value ?? null });
        }
        return new Response('<!doctype html><title>cookies</title>', {
          headers: { 'content-type': 'text/html' },
        });
      },
      { plugins: [useCookies()] },
    );

    const { server, origin } = await listen(adapter);
    try {
      await withBrowser(async browser => {
        const tab = await browser.newPage();
        await tab.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });

        await tab.evaluate(async base => {
          await fetch(`${base}/set`, { credentials: 'same-origin' });
        }, origin);

        const documentCookie = await tab.evaluate(() => {
          return (globalThis as unknown as { document: { cookie: string } }).document.cookie;
        });
        expect(documentCookie).toContain('session=abc');

        const result = await tab.evaluate(async base => {
          const response = await fetch(`${base}/read`, { credentials: 'same-origin' });
          return response.json();
        }, origin);
        expect(result).toEqual({ session: 'abc' });
      });
    } finally {
      await closeServer(server);
    }
  });

  it('keeps HttpOnly cookies out of document.cookie but still sends them', async () => {
    const adapter = createServerAdapter(
      async request => {
        const url = new URL(request.url);
        if (url.pathname === '/set') {
          await request.cookieStore?.set({
            name: 'token',
            value: 'secret',
            path: '/',
            sameSite: 'lax',
            httpOnly: true,
            domain: null,
            expires: null,
          });
          return new Response('set');
        }
        if (url.pathname === '/read') {
          const token = await request.cookieStore?.get('token');
          return Response.json({ token: token?.value ?? null });
        }
        return new Response('<!doctype html><title>httponly</title>', {
          headers: { 'content-type': 'text/html' },
        });
      },
      { plugins: [useCookies()] },
    );

    const { server, origin } = await listen(adapter);
    try {
      await withBrowser(async browser => {
        const tab = await browser.newPage();
        await tab.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });

        await tab.evaluate(async base => {
          await fetch(`${base}/set`, { credentials: 'same-origin' });
        }, origin);

        const documentCookie = await tab.evaluate(() => {
          return (globalThis as unknown as { document: { cookie: string } }).document.cookie;
        });
        expect(documentCookie).not.toContain('token=');

        const result = await tab.evaluate(async base => {
          const response = await fetch(`${base}/read`, { credentials: 'same-origin' });
          return response.json();
        }, origin);
        expect(result).toEqual({ token: 'secret' });
      });
    } finally {
      await closeServer(server);
    }
  });
});
