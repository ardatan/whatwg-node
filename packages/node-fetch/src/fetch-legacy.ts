import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { Readable } from 'stream';
import { createBrotliDecompress, createGunzip, createInflate } from 'zlib';
import { PonyfillAbortError } from './AbortError.js';
import { PonyfillRequest, RequestPonyfillInit } from './Request.js';
import { PonyfillResponse } from './Response.js';
import { PonyfillURL } from './URL.js';
import { getHeadersObj, getResponseForDataUri, getResponseForFile } from './utils.js';

function getRequestFnForProtocol(protocol: string) {
  switch (protocol) {
    case 'http:':
      return httpRequest;
    case 'https:':
      return httpsRequest;
  }
  throw new Error(`Unsupported protocol: ${protocol}`);
}

export function fetchLegacy<TResponseJSON = any, TRequestJSON = any>(
  info: string | PonyfillRequest<TRequestJSON> | URL,
  init?: RequestPonyfillInit,
): Promise<PonyfillResponse<TResponseJSON>> {
  if (typeof info === 'string' || 'href' in info) {
    const ponyfillRequest = new PonyfillRequest(info, init);
    return fetchLegacy(ponyfillRequest);
  }

  const fetchRequest = info;

  return new Promise((resolve, reject) => {
    try {
      const url = new PonyfillURL(fetchRequest.url, 'http://localhost');

      if (url.protocol === 'data:') {
        const response = getResponseForDataUri(url);
        resolve(response);
        return;
      }

      if (url.protocol === 'file:') {
        const response = getResponseForFile(fetchRequest.url);
        resolve(response);
        return;
      }

      const requestFn = getRequestFnForProtocol(url.protocol);

      const nodeReadable = (
        fetchRequest.body != null
          ? 'pipe' in fetchRequest.body
            ? fetchRequest.body
            : Readable.from(fetchRequest.body)
          : null
      ) as Readable | null;
      const headersSerializer = fetchRequest.headersSerializer || getHeadersObj;
      const nodeHeaders = headersSerializer(fetchRequest.headers);

      const nodeRequest = requestFn(fetchRequest.url, {
        method: fetchRequest.method,
        headers: nodeHeaders,
        signal: fetchRequest.signal,
      });

      // TODO: will be removed after v16 reaches EOL
      fetchRequest.signal?.addEventListener('abort', () => {
        if (!nodeRequest.aborted) {
          nodeRequest.abort();
        }
      });
      // TODO: will be removed after v16 reaches EOL
      nodeRequest.once('abort', (reason: any) => {
        reject(new PonyfillAbortError(reason));
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
            const redirectedUrl = new PonyfillURL(nodeResponse.headers.location, url);
            const redirectResponse$ = fetchLegacy(redirectedUrl, info);
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
        const responseHeaders: Record<string, string | string[] | undefined> = nodeResponse.headers;
        const ponyfillResponse = new PonyfillResponse(responseBody, {
          status: nodeResponse.statusCode,
          statusText: nodeResponse.statusMessage,
          headers: responseHeaders,
          url: info.url,
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
