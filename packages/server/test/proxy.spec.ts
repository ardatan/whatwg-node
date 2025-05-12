import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { setTimeout } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { runTestsForEachFetchImpl } from './test-fetch';
import { runTestsForEachServerImpl } from './test-server';

const describeIf = (condition: boolean) => (condition ? describe : describe.skip);
const skipIf = (condition: boolean) => (condition ? it.skip : it);
// Bun does not support streams on Request body
// Readable streams for fetch() are not available on Bun
describeIf(!globalThis.Bun && !globalThis.Deno)('Proxy', () => {
  runTestsForEachFetchImpl(
    (fetchImplName, { createServerAdapter, fetchAPI: { fetch, Response, URL } }) => {
      let aborted: boolean = false;
      const originalAdapter = createServerAdapter(async request => {
        if (request.url.endsWith('/delay')) {
          await new Promise<void>(resolve => {
            const timeout = globalThis.setTimeout(() => {
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
      runTestsForEachServerImpl((originalServer, serverImplName) => {
        beforeEach(() => originalServer.addOnceHandler(originalAdapter));
        const proxyAdapter = createServerAdapter(request => {
          const proxyUrl = new URL(request.url);
          return fetch(`${originalServer.url}${proxyUrl.pathname}`, {
            method: request.method,
            headers: Object.fromEntries(
              [...request.headers.entries()].filter(([key]) => key !== 'host'),
            ),
            body: request.body,
            signal: request.signal,
            // @ts-expect-error duplex is not part of RequestInit type yet
            duplex: 'half',
          });
        });
        const proxyServer = createServer(proxyAdapter);
        beforeEach(
          () =>
            new Promise<void>(resolve => {
              proxyServer.listen(0, () => resolve());
            }),
        );
        afterEach(
          () =>
            new Promise<void>(resolve => {
              proxyServer.close(() => resolve());
            }),
        );
        skipIf(serverImplName === 'fastify' && fetchImplName === 'native')(
          'proxies requests',
          async () => {
            const requestBody = JSON.stringify({
              test: true,
            });
            const response = await fetch(
              `http://localhost:${(proxyServer.address() as AddressInfo).port}/test`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: requestBody,
              },
            );
            expect(response.ok).toBe(true);
            await expect(response.json()).resolves.toMatchObject({
              method: 'POST',
              headers: {
                'content-type': 'application/json',
              },
              body: requestBody,
            });
          },
        );
        it('handles aborted requests', async () => {
          const response = fetch(
            `http://localhost:${(proxyServer.address() as AddressInfo).port}/delay`,
            {
              signal: AbortSignal.timeout(500),
            },
          );
          await expect(response).rejects.toThrow();
          await setTimeout(500);
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
          await setTimeout(1000);
          expect(aborted).toBe(false);
        });
      });
    },
  );
});
