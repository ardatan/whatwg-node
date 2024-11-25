import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { PassThrough, Readable, promises as streamPromises } from 'stream';
import { createBrotliDecompress, createGunzip, createInflate, createInflateRaw } from 'zlib';
import { PonyfillRequest } from './Request.js';
import { PonyfillResponse } from './Response.js';
import { PonyfillURL } from './URL.js';
import { getHeadersObj, isNodeReadable } from './utils.js';

function getRequestFnForProtocol(url: string) {
  if (url.startsWith('http:')) {
    return httpRequest;
  } else if (url.startsWith('https:')) {
    return httpsRequest;
  }
  throw new Error(`Unsupported protocol: ${url.split(':')[0] || url}`);
}

export function fetchNodeHttp<TResponseJSON = any, TRequestJSON = any>(
  fetchRequest: PonyfillRequest<TRequestJSON>,
): Promise<PonyfillResponse<TResponseJSON>> {
  return new Promise((resolve, reject) => {
    try {
      const requestFn = getRequestFnForProtocol(
        fetchRequest.parsedUrl?.protocol || fetchRequest.url,
      );

      const nodeReadable = (
        fetchRequest.body != null
          ? isNodeReadable(fetchRequest.body)
            ? fetchRequest.body
            : Readable.from(fetchRequest.body)
          : null
      ) as Readable | null;
      const headersSerializer: typeof getHeadersObj =
        (fetchRequest.headersSerializer as any) || getHeadersObj;
      const nodeHeaders = headersSerializer(fetchRequest.headers);
      if (nodeHeaders['accept-encoding'] == null) {
        nodeHeaders['accept-encoding'] = 'gzip, deflate, br';
      }

      let nodeRequest: ReturnType<typeof requestFn>;

      if (fetchRequest.parsedUrl) {
        nodeRequest = requestFn({
          host: fetchRequest.parsedUrl.host,
          hostname: fetchRequest.parsedUrl.hostname,
          method: fetchRequest.method,
          path: fetchRequest.parsedUrl.pathname + (fetchRequest.parsedUrl.search || ''),
          port: fetchRequest.parsedUrl.port,
          protocol: fetchRequest.parsedUrl.protocol,
          headers: nodeHeaders,
          signal: fetchRequest['_signal'] ?? undefined,
          agent: fetchRequest.agent,
        });
      } else {
        nodeRequest = requestFn(fetchRequest.url, {
          method: fetchRequest.method,
          headers: nodeHeaders,
          signal: fetchRequest['_signal'] ?? undefined,
          agent: fetchRequest.agent,
        });
      }

      nodeRequest.once('response', nodeResponse => {
        let outputStream: PassThrough;
        const contentEncoding = nodeResponse.headers['content-encoding'];
        switch (contentEncoding) {
          case 'x-gzip':
          case 'gzip':
            outputStream = createGunzip();
            break;
          case 'x-deflate':
          case 'deflate':
            outputStream = createInflate();
            break;
          case 'x-deflate-raw':
          case 'deflate-raw':
            outputStream = createInflateRaw();
            break;
          case 'br':
            outputStream = createBrotliDecompress();
            break;
          default:
            outputStream = new PassThrough();
        }
        if (nodeResponse.headers.location) {
          if (fetchRequest.redirect === 'error') {
            const redirectError = new Error('Redirects are not allowed');
            reject(redirectError);
            nodeResponse.resume();
            return;
          }
          if (fetchRequest.redirect === 'follow') {
            const redirectedUrl = new PonyfillURL(
              nodeResponse.headers.location,
              fetchRequest.parsedUrl || fetchRequest.url,
            );
            const redirectResponse$ = fetchNodeHttp(
              new PonyfillRequest(redirectedUrl, fetchRequest),
            );
            resolve(
              redirectResponse$.then(redirectResponse => {
                redirectResponse.redirected = true;
                return redirectResponse;
              }),
            );
            nodeResponse.resume();
            return;
          }
        }
        streamPromises
          .pipeline(nodeResponse, outputStream, {
            signal: fetchRequest['_signal'] ?? undefined,
            end: true,
          })
          .then(() => {
            if (!nodeResponse.destroyed) {
              nodeResponse.resume();
            }
          })
          .catch(reject);

        const ponyfillResponse = new PonyfillResponse(outputStream, {
          status: nodeResponse.statusCode,
          statusText: nodeResponse.statusMessage,
          headers: nodeResponse.headers as Record<string, string>,
          url: fetchRequest.url,
        });
        resolve(ponyfillResponse);
      });
      nodeRequest.once('error', reject);

      if (nodeReadable) {
        nodeReadable.pipe(nodeRequest);
      } else {
        nodeRequest.end();
      }
    } catch (e) {
      reject(e);
    }
  });
}
