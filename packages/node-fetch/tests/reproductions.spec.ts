import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { afterEach, expect, it } from '@jest/globals';
import { createDeferredPromise } from '@whatwg-node/promise-helpers';
import { fetchNodeHttp } from '../src/fetchNodeHttp';
import { PonyfillRequest } from '../src/Request.js';

function getActiveRequestCount(): number | undefined {
  const getActiveRequests = (process as NodeJS.Process & { _getActiveRequests?: () => unknown[] })
    ._getActiveRequests;
  return typeof getActiveRequests === 'function'
    ? getActiveRequests.call(process).length
    : undefined;
}

if (!globalThis.Bun && !globalThis.Deno) {
  let server: ReturnType<typeof createServer> | undefined;
  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server?.close(err => (err ? reject(err) : resolve())),
      );
      server = undefined;
    }
  });

  it('cleans up in-flight POST request and body when aborted before response', async () => {
    const baseline = getActiveRequestCount() ?? 0;

    server = createServer((_req, _res) => {
      // Never respond so abort happens before any response headers.
    });
    await new Promise<void>(resolve => server?.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    const body = new Readable({
      read() {
        this.push('request-body');
      },
    });
    const controller = new AbortController();
    const fetchPromise = fetchNodeHttp(
      new PonyfillRequest(`http://127.0.0.1:${port}/post`, {
        method: 'POST',
        body: body as unknown as BodyInit,
        signal: controller.signal,
      }),
    );

    controller.abort();

    try {
      await fetchPromise;
    } catch {
      // expected
    }

    expect(body.destroyed).toBe(true);
    if (getActiveRequestCount() != null) {
      expect(getActiveRequestCount()).toBeLessThanOrEqual(baseline);
    }
  });

  it('should receive the client side "break" in the server side', async () => {
    const onCancel$ = createDeferredPromise<void>();
    server = createServer((_req, res) => {
      const interval = setInterval(() => {
        // Sending data to client every 300ms
        res.write('hello world\n');
      }, 300);
      res.once('close', () => {
        // Client has closed the connection
        clearInterval(interval);
        onCancel$.resolve();
      });
    });
    await new Promise<void>(resolve => server?.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;
    const url = `http://localhost:${port}`;
    const response = await fetchNodeHttp(new PonyfillRequest(url));
    let i = 0;
    // @ts-expect-error - ReadableStream is AsyncIterable
    for await (const chunk of response.body) {
      // Receiving data chunks from server
      if (i++ === 2) {
        // After receiving 2 chunks, we break the stream from client side
        break;
      }
    }
    await onCancel$.promise;
  });
}
