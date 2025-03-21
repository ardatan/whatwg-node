import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, expect, it } from '@jest/globals';
import { createDeferredPromise, createServerAdapter, Response } from '@whatwg-node/server';

let server: Server | undefined;
afterAll(() => {
  if (server) {
    return new Promise<void>((resolve, reject) =>
      server?.close(err => (err ? reject(err) : resolve())),
    );
  }
});
it('bun issue#12368', async () => {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  const echoAdapter = createServerAdapter(req =>
    req.json().then(body =>
      Response.json({
        body,
        url: req.url,
      }),
    ),
  );

  app.use('/my-path', echoAdapter);

  server = await new Promise<Server>((resolve, reject) => {
    const server = app.listen(0, err => (err ? reject(err) : resolve(server)));
  });

  const port = (server.address() as AddressInfo).port;

  const response = await fetch(`http://localhost:${port}/my-path`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hello: 'world' }),
  });

  const bodyText = await response.text();
  expect(bodyText).toEqual(
    JSON.stringify({
      body: { hello: 'world' },
      url: `http://localhost:${port}/my-path`,
    }),
  );
});

if (!globalThis.Bun || !globalThis.Deno) {
  it('should not hang on req.text() outside handler', async () => {
    const { promise: wait, resolve: unwait } = createDeferredPromise<Request>();

    await using server = createServer(
      createServerAdapter(req => {
        unwait(req);
        return new Response();
      }),
    );

    await new Promise<void>(resolve => server.listen(0, resolve));

    const url = `http://localhost:${(server.address() as AddressInfo).port}`;
    await fetch(url, {
      method: 'POST',
      body: 'hello world',
    });

    const req = await wait;

    try {
      await req!.text();
    } catch (err: any) {
      expect(err.message).toEqual('Readable stream has already been consumed or destroyed.');
    }
  });
}
