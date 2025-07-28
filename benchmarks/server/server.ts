import { Blob as BufferBlob } from 'node:buffer';
import { createServer } from 'node:http';
import * as undici from 'undici';
import { App } from 'uWebSockets.js';
import { createServerAdapter, Response } from '@whatwg-node/server';

let serverAdapter: ReturnType<typeof createServerAdapter>;
if (process.env.SCENARIO === 'native') {
  serverAdapter = createServerAdapter(
    req => {
      if (req.method === 'POST') {
        return req
          .json()
          .then(({ name }) => globalThis.Response.json({ message: `Hello, ${name}!` }));
      }
      return new globalThis.Response();
    },
    {
      fetchAPI: {
        fetch: globalThis.fetch,
        Request: globalThis.Request,
        Response: globalThis.Response,
        Headers: globalThis.Headers,
        FormData: globalThis.FormData,
        ReadableStream: globalThis.ReadableStream,
        WritableStream: globalThis.WritableStream,
        CompressionStream: globalThis.CompressionStream,
        TransformStream: globalThis.TransformStream,
        Blob: globalThis.Blob,
        File: globalThis.File,
        crypto: globalThis.crypto,
        btoa: globalThis.btoa,
        TextDecoder: globalThis.TextDecoder,
        TextEncoder: globalThis.TextEncoder,
        URL: globalThis.URL,
        URLSearchParams: globalThis.URLSearchParams,
      },
    },
  );
} else if (process.env.SCENARIO === 'undici') {
  serverAdapter = (createServerAdapter as any)(
    (req: Request) => {
      if (req.method === 'POST') {
        return req.json().then(({ name }) => undici.Response.json({ message: `Hello, ${name}!` }));
      }
      return new undici.Response();
    },
    {
      fetchAPI: {
        fetch: undici.fetch,
        Request: undici.Request,
        Response: undici.Response,
        Headers: undici.Headers,
        FormData: undici.FormData,
        ReadableStream: globalThis.ReadableStream,
        WritableStream: globalThis.WritableStream,
        CompressionStream: globalThis.CompressionStream,
        TransformStream: globalThis.TransformStream,
        Blob: BufferBlob,
        File: globalThis.File,
        crypto: globalThis.crypto,
        btoa: globalThis.btoa,
        TextDecoder: globalThis.TextDecoder,
        TextEncoder: globalThis.TextEncoder,
        URL: globalThis.URL,
        URLSearchParams: globalThis.URLSearchParams,
      },
    },
  );
} else {
  serverAdapter = createServerAdapter(req => {
    if (req.method === 'POST') {
      return req.json().then(({ name }) => Response.json({ message: `Hello, ${name}!` }));
    }
    return new Response();
  });
}

if (process.env.SCENARIO === 'uws') {
  App()
    .any('/*', serverAdapter)
    .listen(4000, () => {
      console.log('uWebSockets.js server listening on 0.0.0.0:4000');
    });
} else {
  createServer(serverAdapter).listen(4000, () => {
    console.log('listening on 0.0.0.0:4000');
  });
}
