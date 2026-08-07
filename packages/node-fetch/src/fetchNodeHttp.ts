import { request as httpRequest, STATUS_CODES } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Readable } from 'node:stream';
import type { Transform } from 'node:stream';
import zlib from 'node:zlib';
import { handleMaybePromise } from '@whatwg-node/promise-helpers';
import { ensureBodyDraining, trackUnusedBody } from './bodyCleanup.js';
import { PonyfillRequest } from './Request.js';
import { PonyfillResponse } from './Response.js';
import { PonyfillURL } from './URL.js';
import {
  attachAbortSignal,
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

      let signal: AbortSignal | undefined;

      if (fetchRequest._signal == null) {
        signal = undefined;
      } else if (fetchRequest._signal) {
        signal = fetchRequest._signal;
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

      // Drop this listener once headers arrive. Leaving `reject` attached to the
      // ClientRequest retains the Promise (and thus the Response) until the
      // request socket is released — which never happens if the body is unread.
      const onRequestError = (err: Error) => reject(err);
      nodeRequest.once('error', onRequestError);
      nodeRequest.once('response', nodeResponse => {
        nodeRequest.removeListener('error', onRequestError);

        let decodeStream: Transform | undefined;
        const contentEncoding = nodeResponse.headers['content-encoding'];
        switch (contentEncoding) {
          case 'x-gzip':
          case 'gzip':
            decodeStream = zlib.createGunzip();
            break;
          case 'x-deflate':
          case 'deflate':
            decodeStream = zlib.createInflate();
            break;
          case 'x-deflate-raw':
          case 'deflate-raw':
            decodeStream = zlib.createInflateRaw();
            break;
          case 'br':
            decodeStream = zlib.createBrotliDecompress();
            break;
          case 'zstd':
            if (zlib.createZstdDecompress != null) {
              decodeStream = zlib.createZstdDecompress();
            }
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

        let bodyStream: Readable = nodeResponse;
        if (decodeStream) {
          pipeThrough({
            src: nodeResponse,
            dest: decodeStream,
            signal,
            onError: e => {
              if (!nodeResponse.destroyed) {
                nodeResponse.destroy(e);
              }
              if (!decodeStream!.destroyed) {
                decodeStream!.destroy(e);
              }
              reject(e);
            },
          });
          bodyStream = decodeStream;
        } else {
          attachAbortSignal(nodeResponse, signal);
        }

        const statusCode = nodeResponse.statusCode || 200;
        let statusText = nodeResponse.statusMessage || STATUS_CODES[statusCode];
        if (statusText == null) {
          statusText = '';
        }
        const ponyfillResponse = new PonyfillResponse(bodyStream, {
          status: statusCode,
          statusText,
          headers: nodeResponse.headers as Record<string, string>,
          url: fetchRequest.url,
          signal,
        });
        // Release the socket if the Response is GC'd without reading the body.
        // Also start draining immediately — keep-alive agents pin sockets while
        // IncomingMessage stays paused, and FinalizationRegistry alone is too
        // late under load (identity PassThrough used to buffer for this case).
        ponyfillResponse._untrackBody = trackUnusedBody(ponyfillResponse, bodyStream);
        ensureBodyDraining(ponyfillResponse);
        resolve(ponyfillResponse);
      });

      if (fetchRequest['_buffer'] != null) {
        handleMaybePromise(
          () => safeWrite(fetchRequest['_buffer'], nodeRequest),
          () => endStream(nodeRequest),
          reject,
        );
      } else if (fetchRequest['bodyType'] === 'String') {
        handleMaybePromise(
          () => safeWrite(fetchRequest['bodyInit'] as string, nodeRequest),
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
