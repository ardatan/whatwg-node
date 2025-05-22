import { Blob as BufferBlob } from 'node:buffer';
import { createServer } from 'node:http';
import { FastResponse, serve } from 'srvx';
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
  serverAdapter = createServerAdapter(() => new globalThis.Response('Hello, World!'), {
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
  });
} else if (process.env.SCENARIO === 'undici') {
  serverAdapter = (createServerAdapter as any)(() => new undici.Response('Hello, World!'), {
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
  });
} else {
  serverAdapter = createServerAdapter(() => new Response('Hello, World!'));
}

if (process.env.SCENARIO === 'uwebsockets') {
  App()
    .any('/*', serverAdapter)
    .listen(4000, () => {
      console.log('listening on 0.0.0.0:4000');
    });
} else if (process.env.SCENARIO === 'srvx') {
  serve({
    port: 4000,
    silent: true,
    fetch() {
      return new FastResponse('Hello, World!');
    },
  });
} else if (process.env.SCENARIO === 'vanilla-node:http') {
  createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello, World!');
  }).listen(4000, () => {
    console.log('listening on 0.0.0.0:4000');
  });
} else if (process.env.SCENARIO === 'vanilla-uwebsockets') {
  App()
    .any('/*', res => {
      res.writeHeader('Content-Type', 'text/plain');
      res.end('Hello, World!');
    })
    .listen(4000, () => {
      console.log('listening on 0.0.0.0:4000');
    });
} else {
  createServer(serverAdapter).listen(4000, () => {
    console.log('listening on 0.0.0.0:4000');
  });
}
