import { Blob as BufferBlob } from 'node:buffer';
import { createServer } from 'node:http';
import * as undici from 'undici';
import { App } from 'uWebSockets.js';
import {
  createServerAdapter,
  Response,
  ServerAdapter,
  ServerAdapterBaseObject,
} from '@whatwg-node/server';

let serverAdapter: ServerAdapter<{}, ServerAdapterBaseObject<any, any>>;
if (process.env.SCENARIO === 'native') {
  serverAdapter = createServerAdapter(
    () => globalThis.Response.json({ message: `Hello, World!` }),
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
    () => undici.Response.json({ message: `Hello, World!` }),
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
        File: undici.File,
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
  serverAdapter = createServerAdapter(() => Response.json({ message: `Hello, World!` }));
}

if (process.env.SCENARIO === 'uwebsockets') {
  App()
    .any('/*', serverAdapter)
    .listen(4000, () => {
      console.log('listening on 0.0.0.0:4000');
    });
} else {
  createServer(serverAdapter).listen(4000, () => {
    console.log('listening on 0.0.0.0:4000');
  });
}
