import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import compression from 'compression';
import express from 'express';
import { afterEach, expect, it } from '@jest/globals';
import { fetch } from '@whatwg-node/fetch';
import { handleMaybePromise } from '@whatwg-node/promise-helpers';
import {
  createDeferredPromise,
  createServerAdapter,
  FetchAPI,
  Response,
  ServerAdapterPlugin,
  useErrorHandling,
} from '@whatwg-node/server';

let server: Server | undefined;
afterEach(() => {
  if (server) {
    if (!globalThis.Bun) {
      server.closeAllConnections();
    }
    return new Promise<void>((resolve, reject) =>
      server?.close(err => {
        server = undefined;
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }),
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

    expect(await req!.text()).toBeDefined();
  });
}

const bodies = [
  'hello world', // 11 bytes
  'hello world'.repeat(1024 * 1024), // 1MB
  'hello world'.repeat(1024 * 1024 * 5), // 5MB
];

for (const largeBody of bodies) {
  it(`express + compression (${largeBody.length} bytes)`, async () => {
    const app = express();

    app.use(compression());

    const echoAdapter = createServerAdapter(req =>
      req
        .json()
        .then(body =>
          Response.json({
            body,
            url: req.url,
          }),
        )
        .catch(error =>
          Response.json({
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
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
      body: JSON.stringify({ largeBody }),
    });

    const bodyJson = await response.json();
    expect(bodyJson).toEqual({
      body: { largeBody },
      url: `http://localhost:${port}/my-path`,
    });
  });
}

it('express + body_parser + url property in the plugin', async () => {
  let url: string | undefined;
  const serverAdapter = createServerAdapter(
    request =>
      handleMaybePromise(
        () => request.json(),
        body => Response.json(body),
      ),
    {
      fetchAPI: {
        Request: globalThis.Request,
        URL: globalThis.URL,
      },
      plugins: [
        {
          onRequest({ request }) {
            url = request.url;
          },
        },
      ],
    },
  );
  const app = express();
  app.use(express.json());
  app.use(serverAdapter);
  server = await new Promise<Server>((resolve, reject) => {
    const server = app.listen(0, err => (err ? reject(err) : resolve(server)));
  });
  const port = (server.address() as AddressInfo).port;
  const bodyJson = { hello: 'world' };
  const response = await fetch(`http://localhost:${port}/test-path`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bodyJson),
  });
  const body = await response.json();
  expect(body).toEqual(bodyJson);
  expect(url).toBe(`http://localhost:${port}/test-path`);
});

it('if native Request object is sent, the native API is used during the request pipeline', async () => {
  const nativeRequest = new globalThis.Request(`http://localhost:0/test-path`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hello: 'world' }),
  });
  let usedFetchAPIInPlugins: FetchAPI | undefined;
  let usedFetchAPIInHandler: FetchAPI | undefined;
  await using serverAdapter = createServerAdapter(
    async (request, _ctx, fetchAPI) => {
      const body = await request.json();
      usedFetchAPIInHandler = fetchAPI;
      return fetchAPI.Response.json(body);
    },
    {
      plugins: [
        {
          onRequest({ fetchAPI }) {
            usedFetchAPIInPlugins = fetchAPI;
          },
        },
      ],
    },
  );
  const res = await serverAdapter.fetch(nativeRequest);
  expect(res).toBeInstanceOf(globalThis.Response);
  for (const key in usedFetchAPIInPlugins) {
    const keyName = key as keyof FetchAPI;
    // Namespace extras like `createFetch` / `default` are not on globalThis.
    if (!(keyName in globalThis)) {
      continue;
    }
    expect(usedFetchAPIInPlugins![keyName]).toBe(globalThis[keyName as keyof typeof globalThis]);
  }
  for (const key in usedFetchAPIInHandler) {
    const keyName = key as keyof FetchAPI;
    if (!(keyName in globalThis)) {
      continue;
    }
    expect(usedFetchAPIInHandler![keyName]).toBe(globalThis[keyName as keyof typeof globalThis]);
  }
  expect(usedFetchAPIInPlugins!.URLPattern).toBeDefined();
  expect(usedFetchAPIInHandler!.URLPattern).toBeDefined();
  const responseBody = await res.json();
  expect(responseBody).toEqual({ hello: 'world' });
});

it('if native Request object is sent without plugins, the native API is still used', async () => {
  const nativeRequest = new globalThis.Request(`http://localhost:0/test-path`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hello: 'world' }),
  });
  let usedFetchAPIInHandler: FetchAPI | undefined;
  await using serverAdapter = createServerAdapter(async (request, _ctx, fetchAPI) => {
    const body = await request.json();
    usedFetchAPIInHandler = fetchAPI;
    return fetchAPI.Response.json(body);
  });
  const res = await serverAdapter.fetch(nativeRequest);
  expect(res).toBeInstanceOf(globalThis.Response);
  expect(usedFetchAPIInHandler!.Request).toBe(globalThis.Request);
  expect(usedFetchAPIInHandler!.Response).toBe(globalThis.Response);
  expect(usedFetchAPIInHandler!.TransformStream).toBe(globalThis.TransformStream);
  expect(usedFetchAPIInHandler!.URLPattern).toBeDefined();
  const responseBody = await res.json();
  expect(responseBody).toEqual({ hello: 'world' });
});

it('a native Request object can be replaced with a new one using TransformStream', async () => {
  const useMaxRequestBodySize = (limit: number): ServerAdapterPlugin => ({
    onRequest({ request, setRequest, fetchAPI }) {
      if (!request.body) {
        return;
      }

      let bytesRead = 0;
      const limitedBody = request.body.pipeThrough(
        new fetchAPI.TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            bytesRead += chunk.byteLength;
            if (bytesRead > limit) {
              controller.error(new Error(`Request body too large`));
              return;
            }
            controller.enqueue(chunk);
          },
        }),
      );
      const limitedRequest = new fetchAPI.Request(request.url, {
        method: request.method,
        headers: request.headers,
        signal: request.signal,
        body: limitedBody,
        // @ts-expect-error Required by some runtimes for streamed bodies; missing from `fetchAPI.Request`'s types.
        duplex: 'half',
      });
      setRequest(limitedRequest);
    },
  });

  const serverAdapter = createServerAdapter<{}>(
    request =>
      handleMaybePromise(
        () => request.json(),
        body => Response.json(body),
      ),
    {
      plugins: [
        useMaxRequestBodySize(20),
        useErrorHandling((err, _req, _ctx, fetchAPI) =>
          fetchAPI.Response.json(
            {
              error: err.message,
            },
            {
              status: 500,
            },
          ),
        ),
      ],
    },
  );
  // Good case
  const nativeRequest = new globalThis.Request(`http://localhost:0/test-path`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hello: 'world' }),
  });
  const res = await serverAdapter.fetch(nativeRequest);
  const responseBody = await res.json();
  expect(responseBody).toEqual({ hello: 'world' });
  // Exceeding the max request body size
  const largeRequest = new globalThis.Request(`http://localhost:0/test-path`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hello: 'world', extra: 'data' }),
  });
  const failedRes = await serverAdapter.fetch(largeRequest);
  expect(failedRes.status).toBe(500);
  const failedResponseBody = await failedRes.json();
  expect(failedResponseBody).toEqual({ error: 'Request body too large' });
});
