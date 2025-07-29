import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, it } from '@jest/globals';
import { Request } from '@whatwg-node/node-fetch';
import { createDeferredPromise } from '@whatwg-node/promise-helpers';
import { fetchNodeHttp } from '../src/fetchNodeHttp';

if (!globalThis.Bun && !globalThis.Deno) {
  let server: ReturnType<typeof createServer> | undefined;
  afterEach(() => {
    if (server) {
      return new Promise<void>((resolve, reject) =>
        server?.close(err => (err ? reject(err) : resolve())),
      );
    }
  });
  it('should receive the client side "break" in the server side', async () => {
    const onCancel$ = createDeferredPromise<void>();
    server = createServer((_req, res) => {
      const interval = setInterval(() => {
        console.log('Sending data to client');
        res.write('hello world\n');
      }, 300);
      res.once('close', () => {
        console.log('Client closed the connection');
        clearInterval(interval);
        onCancel$.resolve();
      });
    });
    await new Promise<void>(resolve => server?.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;
    const url = `http://localhost:${port}`;
    const response = await fetchNodeHttp(new Request(url));
    let i = 0;
    // @ts-expect-error - ReadableStream is AsyncIterable
    for await (const chunk of response.body) {
      console.log(`Received ${i}nth chunk`);
      if (i++ === 2) {
        console.log('Breaking the stream');
        break;
      }
    }
    await onCancel$.promise;
  });
}
