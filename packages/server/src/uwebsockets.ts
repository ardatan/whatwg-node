import { createDeferredPromise, fakePromise, MaybePromise } from '@whatwg-node/promise-helpers';
import type { FetchAPI } from './types.js';

export interface UWSRequest {
  getMethod(): string;
  forEach(callback: (key: string, value: string) => void): void;
  getUrl(): string;
  getQuery(): string;
  getHeader(key: string): string | undefined;
  setYield(y: boolean): void;
}

export interface UWSResponse {
  onData(callback: (chunk: ArrayBuffer, isLast: boolean) => void): void;
  onDataV2?(callback: (chunk: ArrayBuffer | null, maxRemainingBodyLength: bigint) => void): void;
  onAborted(callback: () => void): void;
  writeStatus(status: string): void;
  writeHeader(key: string, value: string): void;
  end(body?: any): void;
  close(): void;
  write(body: any): boolean;
  cork(callback: () => void): void;
}

export type UWSHandler = (res: UWSResponse, req: UWSRequest) => void | Promise<void>;

export function isUWSResponse(res: any): res is UWSResponse {
  return !!res.onData;
}

interface GetRequestFromUWSOpts {
  req: UWSRequest;
  res: UWSResponse;
  fetchAPI: FetchAPI;
  controller: AbortController;
}

export function getRequestFromUWSRequest({
  req,
  res,
  fetchAPI,
  controller,
}: GetRequestFromUWSOpts): MaybePromise<Request> {
  const method = req.getMethod();

  const headers = new fetchAPI.Headers();
  req.forEach((key, value) => {
    headers.append(key, value);
  });

  let url = `http://localhost${req.getUrl()}`;
  const query = req.getQuery();
  if (query) {
    url += `?${query}`;
  }

  function prepareRequestWithBody(body?: BodyInit, isDuplexHalf = false) {
    return new fetchAPI.Request(url, {
      method,
      headers,
      signal: controller.signal,
      body,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - not in the TS types yet
      duplex: isDuplexHalf ? 'half' : undefined,
    });
  }

  function copyChunk(chunk: ArrayBuffer): Buffer<ArrayBuffer> {
    return Buffer.copyBytesFrom(new Uint8Array(chunk), 0, chunk.byteLength);
  }

  if (method === 'get' || method === 'head') {
    return prepareRequestWithBody();
  } else if (res.onDataV2) {
    const deferred = createDeferredPromise<Request>();
    let stream: ReadableStream | undefined;
    let streamCtrl: ReadableStreamDefaultController<Uint8Array> | undefined;
    controller.signal.addEventListener(
      'abort',
      () => {
        if (streamCtrl) {
          streamCtrl.error(controller.signal.reason);
        } else {
          deferred.reject(controller.signal.reason);
        }
      },
      { once: true },
    );
    res.onDataV2((chunk, maxRemainingBodyLength) => {
      if (chunk) {
        if (maxRemainingBodyLength === ZERO_BIGINT) {
          if (streamCtrl) {
            streamCtrl.enqueue(new Uint8Array(chunk));
            streamCtrl.close();
          } else {
            deferred.resolve(prepareRequestWithBody(chunk));
          }
          /* Done! */
        } else {
          if (streamCtrl) {
            const copiedChunk = copyChunk(chunk);
            streamCtrl.enqueue(copiedChunk);
          } else {
            stream = new fetchAPI.ReadableStream({
              start(ctrl) {
                streamCtrl = ctrl;
                const copiedChunk = copyChunk(chunk);
                ctrl.enqueue(copiedChunk);
              },
            });
            deferred.resolve(prepareRequestWithBody(stream, true));
          }
        }
      }
    });
    return deferred.promise;
  } else {
    return prepareRequestWithBody(
      new fetchAPI.ReadableStream({
        start(streamCtrl) {
          res.onData((chunk, isLast) => {
            if (chunk) {
              const copiedChunk = copyChunk(chunk);
              streamCtrl.enqueue(copiedChunk);
            }
            if (isLast) {
              streamCtrl.close();
            }
          });
          controller.signal.addEventListener(
            'abort',
            () => streamCtrl.error(controller.signal.reason),
            { once: true },
          );
        },
      }),
    );
  }
}

export function createWritableFromUWS(uwsResponse: UWSResponse, fetchAPI: FetchAPI) {
  return new fetchAPI.WritableStream({
    write(chunk) {
      uwsResponse.cork(() => {
        uwsResponse.write(chunk);
      });
    },
    close() {
      uwsResponse.cork(() => {
        uwsResponse.end();
      });
    },
  });
}

export function sendResponseToUwsOpts(
  uwsResponse: UWSResponse,
  fetchResponse: Response,
  controller: AbortController,
  fetchAPI: FetchAPI,
) {
  if (!fetchResponse) {
    uwsResponse.writeStatus('404 Not Found');
    uwsResponse.end();
    return;
  }
  const bufferOfRes: Uint8Array = (fetchResponse as any)._buffer;
  // @ts-expect-error - Handle the case where the response is a string
  const strBody = fetchResponse['bodyType'] === 'String' ? fetchResponse.bodyInit : undefined;
  if (controller.signal.aborted) {
    return;
  }
  uwsResponse.cork(() => {
    uwsResponse.writeStatus(`${fetchResponse.status} ${fetchResponse.statusText}`);
    let isSetCookieHandled = false;
    for (const [key, value] of fetchResponse.headers) {
      // content-length causes an error with Node.js's fetch
      if (key !== 'content-length') {
        if (key === 'set-cookie') {
          if (isSetCookieHandled) {
            continue;
          }
          isSetCookieHandled = true;
          const setCookies = fetchResponse.headers.getSetCookie?.();
          if (setCookies) {
            for (const setCookie of setCookies) {
              uwsResponse.writeHeader(key, setCookie);
            }
            continue;
          }
        }
        uwsResponse.writeHeader(key, value);
      }
    }
    if (strBody) {
      uwsResponse.end(strBody);
    } else if (bufferOfRes) {
      uwsResponse.end(bufferOfRes);
    } else if (!fetchResponse.body) {
      uwsResponse.end();
    }
  });
  if (strBody || bufferOfRes || !fetchResponse.body) {
    return;
  }
  controller.signal.addEventListener(
    'abort',
    () => {
      if (!fetchResponse.body?.locked) {
        fetchResponse.body?.cancel(controller.signal.reason);
      }
    },
    { once: true },
  );
  return fetchResponse.body
    .pipeTo(createWritableFromUWS(uwsResponse, fetchAPI), {
      signal: controller.signal,
    })
    .catch(err => {
      if (controller.signal.aborted) {
        return;
      }
      throw err;
    });
}

export { fakePromise };

const ZERO_BIGINT = BigInt(0);
