import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import compression from 'compression';
import express from 'express';
import { afterEach, expect, it } from '@jest/globals';
import { fetch } from '@whatwg-node/fetch';
import { createDeferredPromise, createServerAdapter, Response } from '@whatwg-node/server';

let server: Server | undefined;
afterEach(() => {
  if (server) {
    if (!globalThis.Bun) {
      server.closeAllConnections();
    }
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

if (!globalThis.Bun && !globalThis.Deno) {
  it('should not hang on req.text() outside handler', async () => {
    const { promise: wait, resolve: unwait } = createDeferredPromise<Request>();

    server = createServer(
      createServerAdapter(req => {
        unwait(req);
        return new Response('hello world');
      }),
    );

    await new Promise<void>(resolve => server?.listen(0, resolve));

    const url = `http://localhost:${(server.address() as AddressInfo).port}`;
    await fetch(url, {
      method: 'POST',
      body: 'hello world',
    });

    const req = await wait;

    expect(await req!.text()).toEqual('hello world');
  });
}

it('express + compression library', async () => {
  const app = express();

  app.use(compression());

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

  const largeBody = 'a'.repeat(1024 * 1024); // 1MB

  const response = await fetch(`http://localhost:${port}/my-path`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ largeBody }),
  });

  const bodyJson = await response.json();
  expect(bodyJson).toEqual({
    body: { largeBody },
    url: `http://localhost:${port}/my-path`,
  });
});
