import { decompressedResponseMap, getSupportedEncodings } from '../utils.js';
import type { ServerAdapterPlugin } from './types.js';

export function useContentEncoding<TServerContext>(): ServerAdapterPlugin<TServerContext> {
  return {
    onRequest({ request, setRequest, fetchAPI, endResponse }) {
      const contentEncodingHeader = request.headers.get('content-encoding');
      if (contentEncodingHeader && contentEncodingHeader !== 'none' && request.body) {
        const contentEncodings = contentEncodingHeader.split(',') as CompressionFormat[];
        if (
          !contentEncodings.every(encoding => getSupportedEncodings(fetchAPI).includes(encoding))
        ) {
          endResponse(
            new fetchAPI.Response(`Unsupported 'Content-Encoding': ${contentEncodingHeader}`, {
              status: 415,
              statusText: 'Unsupported Media Type',
            }),
          );
          return;
        }
        if (contentEncodings.length) {
          let newBody = request.body;
          for (const contentEncoding of contentEncodings) {
            newBody = request.body.pipeThrough(new fetchAPI.DecompressionStream(contentEncoding));
          }
          setRequest(
            new fetchAPI.Request(request.url, {
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
            }),
          );
        }
      }
    },
    onResponse({ request, response, setResponse, fetchAPI }) {
      const acceptEncoding = request.headers.get('accept-encoding');
      if (acceptEncoding) {
        const encodings = acceptEncoding.split(',') as CompressionFormat[];
        if (encodings.length && response.body) {
          const supportedEncoding = encodings.find(encoding =>
            getSupportedEncodings(fetchAPI).includes(encoding),
          );
          if (supportedEncoding) {
            const compressionStream = new fetchAPI.CompressionStream(
              supportedEncoding as CompressionFormat,
            );
            const newHeaders = new fetchAPI.Headers(response.headers);
            newHeaders.set('content-encoding', supportedEncoding);
            newHeaders.delete('content-length');
            const compressedBody = response.body.pipeThrough(compressionStream);
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
