import { describe, expect, it } from 'vitest';
import { createServerAdapter } from '../src/createServerAdapter.js';
import { useCORS } from '../src/plugins/useCors.js';
import { closeServer, listen, withBrowser } from './browser-utils.js';

describe('CORS browser behavior', () => {
  it('allows cross-origin fetch when Origin is in the allowlist', async () => {
    const page = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><title>cors-client</title>');
    });

    const api = await listen(
      createServerAdapter(() => Response.json({ ok: true }), {
        plugins: [useCORS({ origin: [page.origin] })],
      }),
    );

    try {
      await withBrowser(async browser => {
        const tab = await browser.newPage();
        await tab.goto(page.origin, { waitUntil: 'domcontentloaded' });
        const result = await tab.evaluate(async apiOrigin => {
          const response = await fetch(`${apiOrigin}/data`);
          return {
            status: response.status,
            body: await response.json(),
          };
        }, api.origin);
        expect(result).toEqual({ status: 200, body: { ok: true } });
      });
    } finally {
      await Promise.all([closeServer(page.server), closeServer(api.server)]);
    }
  });

  it('blocks cross-origin fetch when Origin is not allowed (no ACAO: null)', async () => {
    const allowedPage = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><title>allowed</title>');
    });
    const disallowedPage = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><title>disallowed</title>');
    });

    let lastAllowOrigin: string | null | undefined;
    const api = await listen(
      createServerAdapter(() => Response.json({ ok: true }), {
        plugins: [
          // length > 1 so a non-matching Origin omits ACAO (single-entry arrays
          // always echo the configured origin, like a string allowlist).
          useCORS({ origin: [allowedPage.origin, 'http://example.com'] }),
          {
            onResponse({ request, response }) {
              if (request.headers.get('origin') === disallowedPage.origin) {
                lastAllowOrigin = response.headers.get('Access-Control-Allow-Origin');
              }
            },
          },
        ],
      }),
    );

    try {
      await withBrowser(async browser => {
        const tab = await browser.newPage();
        await tab.goto(disallowedPage.origin, { waitUntil: 'domcontentloaded' });
        const result = await tab.evaluate(async apiOrigin => {
          try {
            await fetch(`${apiOrigin}/data`);
            return { ok: true as const };
          } catch (error) {
            return {
              ok: false as const,
              name: error instanceof Error ? error.name : 'UnknownError',
            };
          }
        }, api.origin);

        expect(result.ok).toBe(false);
        expect(result).toMatchObject({ name: 'TypeError' });
        // Server must not advertise Access-Control-Allow-Origin: null
        expect(lastAllowOrigin).toBeNull();
      });
    } finally {
      await Promise.all([
        closeServer(allowedPage.server),
        closeServer(disallowedPage.server),
        closeServer(api.server),
      ]);
    }
  });
});
