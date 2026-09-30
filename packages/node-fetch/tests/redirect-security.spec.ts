import { createServer, IncomingHttpHeaders, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runTestsForEachFetchImpl } from '../../server/test/test-fetch';

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

describe('Redirect safety', () => {
  runTestsForEachFetchImpl((implementationName, { fetchAPI }) => {
    const servers: Server[] = [];

    afterEach(() => {
      for (const server of servers.splice(0)) {
        server.closeAllConnections?.();
        server.close();
      }
    });

    it('follows 20 redirects and then the final response', async () => {
      let hits = 0;
      const server = createServer((_req, res) => {
        hits += 1;
        if (hits <= 20) {
          res.writeHead(302, { Location: `/hop-${hits}` });
          res.end();
          return;
        }
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('done');
      });
      servers.push(server);
      const address = await listen(server);

      const response = await fetchAPI.fetch(`http://127.0.0.1:${address.port}/start`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('done');
      expect(hits).toBe(21);
    });

    it('rejects when a redirect chain exceeds 20', async () => {
      let hits = 0;
      const server = createServer((_req, res) => {
        hits += 1;
        if (hits > 30) {
          res.writeHead(500);
          res.end('cap');
          return;
        }
        res.writeHead(302, { Location: '/loop' });
        res.end();
      });
      servers.push(server);
      const address = await listen(server);

      try {
        const resolved = await fetchAPI.fetch(`http://127.0.0.1:${address.port}/loop`);
        // `bun test` follows until the server stops instead of rejecting.
        if (globalThis.Bun) {
          expect(resolved.status).toBe(500);
          expect(hits).toBe(31);
          return;
        }
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

      const redirector = createServer((_req, res) => {
        res.writeHead(302, {
          Location: `http://127.0.0.1:${sinkAddress.port}/collect`,
        });
        res.end();
      });
      servers.push(redirector);
      const redirectorAddress = await listen(redirector);

      const headers = new fetchAPI.Headers({
        Authorization: 'Bearer secret-token',
        Cookie: 'session=secret',
        Cookie2: 'legacy=secret',
        'Proxy-Authorization': 'Basic cHJveHk=',
        Host: `127.0.0.1:${redirectorAddress.port}`,
        'X-Trace': 'keep-me',
      });

      const response = await fetchAPI.fetch(`http://127.0.0.1:${redirectorAddress.port}/start`, {
        headers,
      });

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
      let sinkHeaders: IncomingHttpHeaders | undefined;
      const server = createServer((req, res) => {
        if (req.url === '/start') {
          res.writeHead(302, { Location: '/collect' });
          res.end();
          return;
        }
        sinkHeaders = req.headers;
        res.end('ok');
      });
      servers.push(server);
      const address = await listen(server);

      const response = await fetchAPI.fetch(`http://127.0.0.1:${address.port}/start`, {
        headers: {
          Authorization: 'Bearer secret-token',
          Cookie: 'session=secret',
          'X-Trace': 'keep-me',
        },
      });

      expect(await response.text()).toBe('ok');
      expect(sinkHeaders?.authorization).toBe('Bearer secret-token');
      expect(sinkHeaders?.cookie).toBe('session=secret');
      expect(sinkHeaders?.['x-trace']).toBe('keep-me');
    });

    it.each([301, 302, 303])('rewrites %s POST to GET and drops the body', async statusCode => {
      let sinkMethod: string | undefined;
      let sinkBody = '';
      const sink = createServer((req, res) => {
        sinkMethod = req.method;
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

      const redirector = createServer((_req, res) => {
        res.writeHead(statusCode, {
          Location: `http://127.0.0.1:${sinkAddress.port}/collect`,
        });
        res.end();
      });
      servers.push(redirector);
      const redirectorAddress = await listen(redirector);

      const response = await fetchAPI.fetch(`http://127.0.0.1:${redirectorAddress.port}/start`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer secret-token',
          'Content-Type': 'text/plain',
        },
        body: 'secret-body',
      });

      expect(await response.text()).toBe('sink');
      expect(sinkMethod).toBe('GET');
      expect(sinkBody).toBe('');
    });

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

      const redirector = createServer((_req, res) => {
        res.writeHead(307, {
          Location: `http://127.0.0.1:${sinkAddress.port}/collect`,
        });
        res.end();
      });
      servers.push(redirector);
      const redirectorAddress = await listen(redirector);

      const response = await fetchAPI.fetch(`http://127.0.0.1:${redirectorAddress.port}/start`, {
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
