import { request as httpRequest, STATUS_CODES } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { PassThrough, Readable } from 'node:stream';
import { createBrotliDecompress, createGunzip, createInflate, createInflateRaw } from 'node:zlib';
import { handleMaybePromise } from '@whatwg-node/promise-helpers';
import { PonyfillRequest } from './Request.js';
import { PonyfillResponse } from './Response.js';
import { PonyfillURL } from './URL.js';
import {
  endStream,
  getHeadersObj,
  isNodeReadable,
  pipeThrough,
  safeWrite,
  shouldRedirect,
} from './utils.js';

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

      const headersSerializer: typeof getHeadersObj =
        (fetchRequest.headersSerializer as any) || getHeadersObj;
      const nodeHeaders = headersSerializer(fetchRequest.headers);
      if (nodeHeaders['accept-encoding'] == null) {
        nodeHeaders['accept-encoding'] = 'gzip, deflate, br';
      }

      let signal: AbortSignal | undefined;

      if (fetchRequest._signal === null) {
        signal = undefined;
      } else if (fetchRequest._signal) {
        signal = fetchRequest._signal;
      } else {
        signal = fetchRequest.signal;
      }

      let nodeRequest: ReturnType<typeof requestFn>;

      // If it is our ponyfilled Request, it should have `parsedUrl` which is a `URL` object
      if (fetchRequest.parsedUrl) {
        nodeRequest = requestFn(fetchRequest.parsedUrl, {
          method: fetchRequest.method,
          headers: nodeHeaders,
          signal,
          agent: fetchRequest.agent,
        });
      } else {
        nodeRequest = requestFn(fetchRequest.url, {
          method: fetchRequest.method,
          headers: nodeHeaders,
          signal,
          agent: fetchRequest.agent,
        });
      }

      nodeRequest.once('error', reject);
      nodeRequest.once('response', nodeResponse => {
        let outputStream: PassThrough | undefined;
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
        }
        if (nodeResponse.headers.location && shouldRedirect(nodeResponse.statusCode)) {
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

        if (outputStream != null) {
          pipeThrough({
            src: nodeResponse,
            dest: outputStream,
            signal,
            onError: reject,
          });
        }

        const statusCode = nodeResponse.statusCode || 200;
        let statusText = nodeResponse.statusMessage || STATUS_CODES[statusCode];
        if (statusText == null) {
          statusText = '';
        }
        const ponyfillResponse = new PonyfillResponse(outputStream || nodeResponse, {
          status: statusCode,
          statusText,
          headers: nodeResponse.headers as Record<string, string>,
          url: fetchRequest.url,
          signal,
        });
        resolve(ponyfillResponse);
      });

      if (fetchRequest['_buffer'] != null) {
        handleMaybePromise(
          () => safeWrite(fetchRequest['_buffer'], nodeRequest),
          () => endStream(nodeRequest),
          reject,
        );
      } else {
        const nodeReadable = (
          fetchRequest.body != null
            ? isNodeReadable(fetchRequest.body)
              ? fetchRequest.body
              : Readable.from(fetchRequest.body)
            : null
        ) as Readable | null;
        if (nodeReadable) {
          nodeReadable.pipe(nodeRequest);
        } else {
          endStream(nodeRequest);
        }
      }
    } catch (e) {
      reject(e);
    }
  });
}
