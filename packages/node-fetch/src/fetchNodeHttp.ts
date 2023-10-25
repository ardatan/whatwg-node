import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { Readable } from 'stream';
import { createBrotliDecompress, createGunzip, createInflate } from 'zlib';
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
      const requestFn = getRequestFnForProtocol(fetchRequest.url);

      const nodeReadable = (
        fetchRequest.body != null
          ? isNodeReadable(fetchRequest.body)
            ? fetchRequest.body
            : Readable.from(fetchRequest.body)
          : null
      ) as Readable | null;
      const headersSerializer = (fetchRequest.headersSerializer as any) || getHeadersObj;
      const nodeHeaders = headersSerializer(fetchRequest.headers);

      const nodeRequest = requestFn(fetchRequest.url, {
        method: fetchRequest.method,
        headers: nodeHeaders,
        signal: fetchRequest['_signal'] ?? undefined,
        agent: fetchRequest.agent,
      });

      nodeRequest.once('response', nodeResponse => {
        let responseBody: Readable = nodeResponse;
        const contentEncoding = nodeResponse.headers['content-encoding'];
        switch (contentEncoding) {
          case 'x-gzip':
          case 'gzip':
            responseBody = nodeResponse.pipe(createGunzip());
            break;
          case 'x-deflate':
          case 'deflate':
            responseBody = nodeResponse.pipe(createInflate());
            break;
          case 'br':
            responseBody = nodeResponse.pipe(createBrotliDecompress());
            break;
        }
        if (nodeResponse.headers.location) {
          if (fetchRequest.redirect === 'error') {
            const redirectError = new Error('Redirects are not allowed');
            reject(redirectError);
            nodeResponse.resume();
            return;
          }
          if (fetchRequest.redirect === 'follow') {
            const redirectedUrl = new PonyfillURL(nodeResponse.headers.location, fetchRequest.url);
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
        const ponyfillResponse = new PonyfillResponse(responseBody, {
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
