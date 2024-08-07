import { decompressedResponseMap, getSupportedEncodings } from '../utils.js';
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
    onResponse({ request, response, setResponse, fetchAPI }) {
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
                writer.write(bufOfRes);
                writer.close();
                const reader: ReadableStreamDefaultReader<Uint8Array> =
                  compressionStream.readable.getReader();
                return Promise.resolve().then(async () => {
                  const chunks: number[] = [];
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                      reader.releaseLock();
                      break;
                    } else if (value) {
                      chunks.push(...value);
                    }
                  }
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
