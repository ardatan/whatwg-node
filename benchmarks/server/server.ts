import { Blob as BufferBlob } from 'node:buffer';
import { createServer, type RequestListener } from 'node:http';
import * as undici from 'undici';
import { createServerAdapter, Response } from '@whatwg-node/server';

let serverAdapter: RequestListener;
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
  serverAdapter = createServerAdapter(() => Response.json({ message: `Hello, World!` }));
}

createServer(serverAdapter).listen(4000, () => {
  console.log('listening on 0.0.0.0:4000');
});
