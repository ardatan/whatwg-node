import { request as httpRequest, STATUS_CODES } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { PassThrough, Readable } from 'node:stream';
import zlib from 'node:zlib';
import { handleMaybePromise } from '@whatwg-node/promise-helpers';
import { getAbortRejection, getFetchAbortRejection } from './AbortError.js';
import { getHttpsCheckServerIdentity } from './checkServerIdentity.js';
import { PonyfillRequest } from './Request.js';
import { PonyfillResponse } from './Response.js';
import { PonyfillURL } from './URL.js';
import {
  DEFAULT_ACCEPT_ENCODING,
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

function isHttpsRequest(url: string | URL | undefined): boolean {
  if (!url) {
    return false;
  }
  if (typeof url === 'string') {
    return url.startsWith('https:');
  }
  return url.protocol === 'https:';
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
      nodeHeaders['accept-encoding'] ||= DEFAULT_ACCEPT_ENCODING;
      if (nodeHeaders['user-agent'] == null && nodeHeaders['User-Agent'] == null) {
        nodeHeaders['user-agent'] = 'node';
      }

      const signal = fetchRequest._signal ?? undefined;

      if (signal?.aborted) {
        reject(getAbortRejection(signal));
        return;
      }

      let nodeRequest: ReturnType<typeof requestFn>;
      let requestBody: Readable | null = null;
      let settled = false;
      let responseReceived = false;
      let onAbortBeforeResponse: (() => void) | undefined;
      let rejectRequest: (error: unknown) => void = reject;

      const requestTarget = fetchRequest.parsedUrl || fetchRequest.url;
      const requestOptions: Parameters<typeof httpsRequest>[1] = {
        method: fetchRequest.method,
        headers: nodeHeaders,
        signal,
        agent: fetchRequest.agent,
      };
      // Probe once on first https use; override only if this Node build is affected
      // (https://github.com/nodejs/node/issues/64032).
      const httpsCheckServerIdentity = isHttpsRequest(requestTarget)
        ? getHttpsCheckServerIdentity()
        : undefined;
      if (httpsCheckServerIdentity) {
        requestOptions.checkServerIdentity = httpsCheckServerIdentity;
      }

      if (signal) {
        function cleanupRequest() {
          if (requestBody && !requestBody.destroyed) {
            requestBody.unpipe(nodeRequest);
            requestBody.destroy();
          }
          if (!nodeRequest.destroyed) {
            nodeRequest.destroy();
          }
        }

        function removeAbortListener() {
          if (onAbortBeforeResponse) {
            signal!.removeEventListener('abort', onAbortBeforeResponse);
          }
        }

        rejectRequest = (error: unknown) => {
          if (settled) {
            return;
          }
          settled = true;
          removeAbortListener();
          cleanupRequest();
          reject(getFetchAbortRejection(signal, error));
        };

        onAbortBeforeResponse = () => {
          if (responseReceived || settled) {
            return;
          }
          rejectRequest(getAbortRejection(signal));
        };
        signal.addEventListener('abort', onAbortBeforeResponse, { once: true });
      }

      // If it is our ponyfilled Request, it should have `parsedUrl` which is a `URL` object
      if (fetchRequest.parsedUrl) {
        nodeRequest = requestFn(fetchRequest.parsedUrl, requestOptions);
      } else {
        nodeRequest = requestFn(fetchRequest.url, requestOptions);
      }

      nodeRequest.once('error', rejectRequest);
      nodeRequest.once('response', nodeResponse => {
        if (signal) {
          responseReceived = true;
          if (onAbortBeforeResponse) {
            signal.removeEventListener('abort', onAbortBeforeResponse);
          }
        }

        let outputStream: PassThrough | undefined;
        const contentEncoding = nodeResponse.headers['content-encoding'];
        switch (contentEncoding) {
          case 'x-gzip':
          case 'gzip':
            outputStream = zlib.createGunzip();
            break;
          case 'x-deflate':
          case 'deflate':
            outputStream = zlib.createInflate();
            break;
          case 'x-deflate-raw':
          case 'deflate-raw':
            outputStream = zlib.createInflateRaw();
            break;
          case 'br':
            outputStream = zlib.createBrotliDecompress();
            break;
          case 'zstd':
            if (zlib.createZstdDecompress != null) {
              outputStream = zlib.createZstdDecompress();
            }
            break;
        }
        if (nodeResponse.headers.location && shouldRedirect(nodeResponse.statusCode)) {
          if (fetchRequest.redirect === 'error') {
            const redirectError = new Error('Redirects are not allowed');
            rejectRequest(redirectError);
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
            if (signal) {
              settled = true;
            }
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

        outputStream ||= new PassThrough();

        pipeThrough({
          src: nodeResponse,
          dest: outputStream,
          signal,
          onError: e => {
            if (!nodeResponse.destroyed) {
              nodeResponse.destroy(e);
            }
            if (!outputStream.destroyed) {
              outputStream.destroy(e);
            }
            rejectRequest(e);
          },
        });

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
        if (signal) {
          if (settled) {
            return;
          }
          settled = true;
        }
        resolve(ponyfillResponse);
      });

      if (fetchRequest['_buffer'] != null) {
        handleMaybePromise(
          () => safeWrite(fetchRequest['_buffer'], nodeRequest),
          () => endStream(nodeRequest),
          rejectRequest,
        );
      } else if (fetchRequest['bodyType'] === 'String') {
        handleMaybePromise(
          () => safeWrite(fetchRequest['bodyInit'] as string, nodeRequest),
          () => endStream(nodeRequest),
          rejectRequest,
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
          if (signal) {
            requestBody = nodeReadable;
          }
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
