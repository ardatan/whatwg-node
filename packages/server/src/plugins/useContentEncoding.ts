import { decompressedResponseMap, getSupportedEncodings } from '../utils.js';
import type { ServerAdapterPlugin } from './types.js';

export function useContentEncoding<TServerContext>(): ServerAdapterPlugin<TServerContext> {
  const encodingMap = new WeakMap<Request, string[]>();
  return {
    onRequest({ request, setRequest, fetchAPI, endResponse }) {
      if (request.body) {
        const contentEncodingHeader = request.headers.get('content-encoding');
        if (contentEncodingHeader) {
          const contentEncodings = contentEncodingHeader?.split(',');
          if (
            !contentEncodings.every(encoding =>
              getSupportedEncodings().includes(encoding as CompressionFormat),
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
              new DecompressionStream(contentEncoding as CompressionFormat),
            );
          }
          const newRequest = new fetchAPI.Request(request.url, {
            ...request,
            body: newBody,
          });
          setRequest(newRequest);
        }
      }
      const acceptEncoding = request.headers.get('accept-encoding');
      if (acceptEncoding) {
        encodingMap.set(request, acceptEncoding.split(','));
      }
    },
    onResponse({ request, response, setResponse, fetchAPI }) {
      if (response.body) {
        const encodings = encodingMap.get(request);
        if (encodings) {
          const supportedEncoding = encodings.find(encoding =>
            getSupportedEncodings().includes(encoding as CompressionFormat),
          );
          if (supportedEncoding) {
            const newHeaders = new fetchAPI.Headers(response.headers);
            newHeaders.set('content-encoding', supportedEncoding);
            newHeaders.delete('content-length');
            const compressedBody = response.body.pipeThrough(
              new CompressionStream(supportedEncoding as CompressionFormat),
            );
            const compressedResponse = new fetchAPI.Response(compressedBody, {
              ...response,
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
