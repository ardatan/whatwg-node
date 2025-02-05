import type { Readable } from 'node:stream';
import {
  decompressedResponseMap,
  getSupportedEncodings,
  isAsyncIterable,
  isReadable,
} from '../utils.js';
import type { ServerAdapterPlugin } from './types.js';

export function useContentEncoding<TServerContext>(): ServerAdapterPlugin<TServerContext> {
  const encodingMap = new WeakMap<Request, string[]>();
  return {
    onRequest({ request, setRequest, fetchAPI, endResponse }) {
      if (request.body) {
        const contentEncodingHeader = request.headers.get('content-encoding');
        if (contentEncodingHeader && contentEncodingHeader !== 'none') {
          const contentEncodings = contentEncodingHeader?.split(',');
          if (
            !contentEncodings.every(encoding =>
              getSupportedEncodings(fetchAPI).includes(encoding as CompressionFormat),
            )
          ) {
            endResponse(
              new fetchAPI.Response(`Unsupported 'Content-Encoding': ${contentEncodingHeader}`, {
                status: 415,
                statusText: 'Unsupported Media Type',
              }),
            );
            return;
          }
          let newBody = request.body;
          for (const contentEncoding of contentEncodings) {
            newBody = newBody.pipeThrough(
              new fetchAPI.DecompressionStream(contentEncoding as CompressionFormat),
            );
          }
          request = new fetchAPI.Request(request.url, {
            body: newBody,
            cache: request.cache,
            credentials: request.credentials,
            headers: request.headers,
            integrity: request.integrity,
            keepalive: request.keepalive,
            method: request.method,
            mode: request.mode,
            redirect: request.redirect,
            referrer: request.referrer,
            referrerPolicy: request.referrerPolicy,
            signal: request.signal,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - not in the TS types yet
            duplex: 'half',
          });
          setRequest(request);
        }
      }
      const acceptEncoding = request.headers.get('accept-encoding');
      if (acceptEncoding) {
        encodingMap.set(request, acceptEncoding.split(','));
      }
    },
    onResponse({ request, response, setResponse, fetchAPI, serverContext }) {
      // Hack for avoiding to create whatwg-node to create a readable stream until it's needed
      if ((response as any)['bodyInit'] || response.body) {
        const encodings = encodingMap.get(request);
        if (encodings) {
          const supportedEncoding = encodings.find(encoding =>
            getSupportedEncodings(fetchAPI).includes(encoding as CompressionFormat),
          );
          if (supportedEncoding) {
            const compressionStream = new fetchAPI.CompressionStream(
              supportedEncoding as CompressionFormat,
            );
            // To calculate final content-length
            const contentLength = response.headers.get('content-length');
            if (contentLength) {
              const bufOfRes = (response as any)._buffer;
              if (bufOfRes) {
                const writer = compressionStream.writable.getWriter();
                const write$ = writer.write(bufOfRes);
                serverContext.waitUntil?.(write$);
                const close$ = writer.close();
                serverContext.waitUntil?.(close$);
                const uint8Arrays$ = isReadable((compressionStream.readable as any)['readable'])
                  ? collectReadableValues((compressionStream.readable as any)['readable'])
                  : isAsyncIterable(compressionStream.readable)
                    ? collectAsyncIterableValues(compressionStream.readable)
                    : collectReadableStreamValues(compressionStream.readable);
                return uint8Arrays$.then(uint8Arrays => {
                  const chunks = uint8Arrays.flatMap(uint8Array => [...uint8Array]);
                  const uint8Array = new Uint8Array(chunks);
                  const newHeaders = new fetchAPI.Headers(response.headers);
                  newHeaders.set('content-encoding', supportedEncoding);
                  newHeaders.set('content-length', uint8Array.byteLength.toString());
                  const compressedResponse = new fetchAPI.Response(uint8Array, {
                    ...response,
                    headers: newHeaders,
                  });
                  decompressedResponseMap.set(compressedResponse, response);
                  setResponse(compressedResponse);
                  const close$ = compressionStream.writable.close();
                  serverContext.waitUntil?.(close$);
                });
              }
            }
            const newHeaders = new fetchAPI.Headers(response.headers);
            newHeaders.set('content-encoding', supportedEncoding);
            newHeaders.delete('content-length');
            const compressedBody = response.body!.pipeThrough(compressionStream);
            const compressedResponse = new fetchAPI.Response(compressedBody, {
              status: response.status,
              statusText: response.statusText,
              headers: newHeaders,
            });
            decompressedResponseMap.set(compressedResponse, response);
            setResponse(compressedResponse);
          }
        }
      }
    },
  };
}

function collectReadableValues<T>(readable: Readable): Promise<T[]> {
  const values: T[] = [];
  readable.on('data', value => values.push(value));
  return new Promise((resolve, reject) => {
    readable.once('end', () => resolve(values));
    readable.once('error', reject);
  });
}

async function collectAsyncIterableValues<T>(asyncIterable: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of asyncIterable) {
    values.push(value);
  }
  return values;
}

async function collectReadableStreamValues<T>(readableStream: ReadableStream<T>): Promise<T[]> {
  const reader = readableStream.getReader();
  const values: T[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      reader.releaseLock();
      break;
    } else if (value) {
      values.push(value);
    }
  }
  return values;
}
