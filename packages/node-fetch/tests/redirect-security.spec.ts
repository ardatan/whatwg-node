import {
  createServer,
  globalAgent as httpGlobalAgent,
  IncomingHttpHeaders,
  Server,
} from 'node:http';
import { globalAgent as httpsGlobalAgent } from 'node:https';
import { AddressInfo } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, afterEach, describe, expect, it } from '@jest/globals';
import { runTestsForEachFetchImpl } from '../../server/test/test-fetch';
import { runTestsForEachServerImpl } from '../../server/test/test-server';

function listen(server: Server): Promise<AddressInfo> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve(server.address() as AddressInfo);
    });
  });
}

const REDIRECT_LIMIT_ERROR =
  /redirect count exceeded|maximum number of redirects|redirected too many times|TooManyRedirects/i;

function redirectFailureText(error: unknown): string {
  if (error == null || typeof error !== 'object') {
    return String(error);
  }
  const current = error as { message?: unknown; cause?: unknown; code?: unknown };
  const cause =
    current.cause != null && typeof current.cause === 'object'
      ? (current.cause as { message?: unknown }).message
      : undefined;
  return `${String(current.message ?? error)} ${String(cause ?? '')} ${String(current.code ?? '')}`;
}

afterAll(async () => {
  httpGlobalAgent.destroy();
  httpsGlobalAgent.destroy();
  // Let socket close callbacks run before Jest's leak detector snapshots this isolate.
  await delay(50);
});

describe('Redirect safety', () => {
  runTestsForEachFetchImpl((implementationName, { createServerAdapter, fetchAPI }) => {
    const servers: Server[] = [];

    afterEach(async () => {
      await Promise.all(
        servers.splice(0).map(
          server =>
            new Promise<void>(resolve => {
              server.closeAllConnections?.();
              server.close(() => resolve());
            }),
        ),
      );
    });

    runTestsForEachServerImpl(server => {
      it('follows 20 redirects and then the final response', async () => {
        let hits = 0;
        await server.addOnceHandler(
          createServerAdapter(() => {
            hits += 1;
            if (hits <= 20) {
              return new fetchAPI.Response(null, {
                status: 302,
                headers: { Location: `/hop-${hits}` },
              });
            }
            return new fetchAPI.Response('done', {
              headers: { 'content-type': 'text/plain' },
            });
          }),
        );

        const response = await fetchAPI.fetch(new URL('/start', server.url));

        expect(response.status).toBe(200);
        expect(await response.text()).toBe('done');
        expect(hits).toBe(21);
      });

      it('rejects when a redirect chain exceeds 20', async () => {
        let hits = 0;
        await server.addOnceHandler(
          createServerAdapter(() => {
            hits += 1;
            if (hits > 30) {
              return new fetchAPI.Response('cap', { status: 500 });
            }
            return new fetchAPI.Response(null, {
              status: 302,
              headers: { Location: '/loop' },
            });
          }),
        );

        try {
          const resolved = await fetchAPI.fetch(new URL('/loop', server.url));
          // `bun test` follows until the server stops instead of rejecting.
          if (globalThis.Bun) {
            expect(resolved.status).toBe(500);
            expect(hits).toBe(31);
            await resolved.text();
            return;
          }
          await resolved.text();
          throw new Error('redirect chain should have been rejected');
        } catch (error) {
          expect(redirectFailureText(error)).toMatch(REDIRECT_LIMIT_ERROR);
        }
        expect(hits).toBe(21);
      });

      it('strips credential headers on a cross-origin redirect and leaves the caller headers intact', async () => {
        let sinkHeaders: IncomingHttpHeaders | undefined;
        const sink = createServer((req, res) => {
          sinkHeaders = req.headers;
          res.end('sink');
        });
        servers.push(sink);
        const sinkAddress = await listen(sink);

        await server.addOnceHandler(
          createServerAdapter(
            () =>
              new fetchAPI.Response(null, {
                status: 302,
                headers: { Location: `http://127.0.0.1:${sinkAddress.port}/collect` },
              }),
          ),
        );

        const redirector = new URL(server.url);
        const headers = new fetchAPI.Headers({
          Authorization: 'Bearer secret-token',
          Cookie: 'session=secret',
          Cookie2: 'legacy=secret',
          'Proxy-Authorization': 'Basic cHJveHk=',
          Host: redirector.host,
          'X-Trace': 'keep-me',
        });

        const response = await fetchAPI.fetch(new URL('/start', server.url), { headers });

        expect(response.status).toBe(200);
        expect(await response.text()).toBe('sink');
        expect(sinkHeaders?.authorization).toBeUndefined();
        expect(sinkHeaders?.cookie).toBeUndefined();
        expect(sinkHeaders?.['proxy-authorization']).toBeUndefined();
        if (implementationName === 'node-http' && !globalThis.Bun) {
          expect(sinkHeaders?.cookie2).toBeUndefined();
        }
        expect(sinkHeaders?.['x-trace']).toBe('keep-me');
        expect(sinkHeaders?.host).toBe(`127.0.0.1:${sinkAddress.port}`);
        expect(headers.get('authorization')).toBe('Bearer secret-token');
        expect(headers.get('cookie')).toBe('session=secret');
      });

      it('keeps credential headers on a same-origin redirect', async () => {
        let authorization: string | null = null;
        let cookie: string | null = null;
        let trace: string | null = null;
        await server.addOnceHandler(
          createServerAdapter(request => {
            if (new URL(request.url).pathname === '/start') {
              return new fetchAPI.Response(null, {
                status: 302,
                headers: { Location: '/collect' },
              });
            }
            authorization = request.headers.get('authorization');
            cookie = request.headers.get('cookie');
            trace = request.headers.get('x-trace');
            return new fetchAPI.Response('ok');
          }),
        );

        const response = await fetchAPI.fetch(new URL('/start', server.url), {
          headers: {
            Authorization: 'Bearer secret-token',
            Cookie: 'session=secret',
            'X-Trace': 'keep-me',
          },
        });

        expect(await response.text()).toBe('ok');
        expect(authorization).toBe('Bearer secret-token');
        expect(cookie).toBe('session=secret');
        expect(trace).toBe('keep-me');
      });

      it.each([301, 302, 303])('rewrites %s POST to GET and drops the body', async statusCode => {
        let method = '';
        let body = '';
        await server.addOnceHandler(
          createServerAdapter(async request => {
            if (new URL(request.url).pathname === '/start') {
              return new fetchAPI.Response(null, {
                status: statusCode,
                headers: { Location: '/collect' },
              });
            }
            method = request.method;
            body = await request.text();
            return new fetchAPI.Response('sink');
          }),
        );

        const response = await fetchAPI.fetch(new URL('/start', server.url), {
          method: 'POST',
          headers: {
            Authorization: 'Bearer secret-token',
            'Content-Type': 'text/plain',
          },
          body: 'secret-body',
        });

        expect(await response.text()).toBe('sink');
        expect(method).toBe('GET');
        expect(body).toBe('');
      });

      it.each([307, 308])('replays a POST body across two %s redirects', async statusCode => {
        let method = '';
        let body = '';
        await server.addOnceHandler(
          createServerAdapter(async request => {
            const path = new URL(request.url).pathname;
            if (path === '/start' || path === '/mid') {
              return new fetchAPI.Response(null, {
                status: statusCode,
                headers: { Location: path === '/start' ? '/mid' : '/done' },
              });
            }
            method = request.method;
            body = await request.text();
            return new fetchAPI.Response('ok');
          }),
        );

        const response = await fetchAPI.fetch(new URL('/start', server.url), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: 'secret-body',
        });

        expect(await response.text()).toBe('ok');
        expect(method).toBe('POST');
        expect(body).toBe('secret-body');
      });

      (globalThis.Bun ? it.skip : it)(
        'rejects a 307 redirect when the body is a stream',
        async () => {
          await server.addOnceHandler(
            createServerAdapter(
              () =>
                new fetchAPI.Response(null, {
                  status: 307,
                  headers: { Location: '/done' },
                }),
            ),
          );

          const stream = new fetchAPI.ReadableStream({
            start(controller: ReadableStreamDefaultController<Uint8Array>) {
              controller.enqueue(new TextEncoder().encode('secret-body'));
              controller.close();
            },
          });

          try {
            const resolved = await fetchAPI.fetch(new URL('/start', server.url), {
              method: 'POST',
              body: stream,
              headers: { 'Content-Type': 'text/plain' },
              // Streaming request bodies require duplex, which is not on this RequestInit yet.
              // @ts-expect-error duplex is not part of RequestInit type yet
              duplex: 'half',
            });
            await resolved.text();
            throw new Error('stream redirect should have been rejected');
          } catch (error) {
            expect(redirectFailureText(error)).toMatch(/replay|body|failed|unusable|disturbed/i);
          }
        },
      );

      it('keeps POST method and body on a 307 redirect, without credential headers', async () => {
        let sinkMethod: string | undefined;
        let sinkBody = '';
        let sinkHeaders: IncomingHttpHeaders | undefined;
        const sink = createServer((req, res) => {
          sinkMethod = req.method;
          sinkHeaders = req.headers;
          req.setEncoding('utf8');
          req.on('data', chunk => {
            sinkBody += chunk;
          });
          req.on('end', () => {
            res.end('sink');
          });
        });
        servers.push(sink);
        const sinkAddress = await listen(sink);

        await server.addOnceHandler(
          createServerAdapter(
            () =>
              new fetchAPI.Response(null, {
                status: 307,
                headers: { Location: `http://127.0.0.1:${sinkAddress.port}/collect` },
              }),
          ),
        );

        const response = await fetchAPI.fetch(new URL('/start', server.url), {
          method: 'POST',
          headers: {
            Authorization: 'Bearer secret-token',
            'Content-Type': 'text/plain',
            'X-Trace': 'keep-me',
          },
          body: 'secret-body',
        });

        expect(await response.text()).toBe('sink');
        expect(sinkMethod).toBe('POST');
        expect(sinkBody).toBe('secret-body');
        expect(sinkHeaders?.authorization).toBeUndefined();
        expect(sinkHeaders?.['content-type']).toBe('text/plain');
        expect(sinkHeaders?.['x-trace']).toBe('keep-me');
      });
    });
  });
});
