import { createServer } from 'http';
import { AddressInfo } from 'net';
import { fetch } from '@whatwg-node/fetch';
import { createServerAdapter } from '../src/createServerAdapter';
import { runTestsForEachFetchImpl } from './test-fetch';
import { runTestsForEachServerImpl } from './test-server';

describe('Proxy', () => {
  let aborted: boolean = false;
  const originalAdapter = createServerAdapter(async request => {
    if (request.url.endsWith('/delay')) {
      await new Promise<void>(resolve => {
        const timeout = setTimeout(() => {
          resolve();
        }, 1000);
        request.signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          aborted = true;
          resolve();
        });
      });
      aborted = request.signal.aborted;
    }
    return Response.json({
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text(),
    });
  });
  beforeEach(() => {
    aborted = false;
  });
  runTestsForEachServerImpl(originalServer => {
    beforeEach(() => {
      originalServer.addOnceHandler(originalAdapter);
    });
    const proxyAdapter = createServerAdapter(request => {
      const proxyUrl = new URL(request.url);
      return fetch(`${originalServer.url}${proxyUrl.pathname}`, {
        method: request.method,
        headers: Object.fromEntries(
          [...request.headers.entries()].filter(([key]) => key !== 'host'),
        ),
        body: request.body,
        signal: request.signal,
      });
    });
    const proxyServer = createServer(proxyAdapter);
    beforeAll(done => {
      proxyServer.listen(0, () => done());
    });
    afterAll(done => {
      proxyServer.close(() => done());
    });
    runTestsForEachFetchImpl(() => {
      it('proxies requests', async () => {
        const response = await fetch(
          `http://localhost:${(proxyServer.address() as AddressInfo).port}/test`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              test: true,
            }),
          },
        );
        expect(await response.json()).toMatchObject({
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            test: true,
          }),
        });
        expect(response.status).toBe(200);
      });
      it('handles aborted requests', async () => {
        const response = fetch(
          `http://localhost:${(proxyServer.address() as AddressInfo).port}/delay`,
          {
            signal: AbortSignal.timeout(500),
          },
        );
        await expect(response).rejects.toThrow();
        await new Promise<void>(resolve => setTimeout(resolve, 500));
        expect(aborted).toBe(true);
      });
      it('handles requested terminated before abort', async () => {
        const res = await fetch(
          `http://localhost:${(proxyServer.address() as AddressInfo).port}/delay`,
          {
            signal: AbortSignal.timeout(2000),
          },
        );
        expect(res.ok).toBe(true);
        await res.text();
        await new Promise(resolve => setTimeout(resolve, 1000));
        expect(aborted).toBe(false);
      });
    });
  });
});
