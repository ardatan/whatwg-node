import { fakePromise, handleMaybePromise, MaybePromise } from '@whatwg-node/promise-helpers';
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
  pause(): void;
  resume(): void;
}

export type UWSHandler = (res: UWSResponse, req: UWSRequest) => void | Promise<void>;

export function isUWSResponse(res: any): res is UWSResponse {
  return !!res.onData;
}

const MAX_BUFFER_LENGTH = 2 * 1024 * 1024 * 1024;
const ZERO_BIGINT = BigInt(0);

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
}: GetRequestFromUWSOpts): Request {
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

  // eslint-disable-next-line no-undef-init
  let body: ReadableStream<Uint8Array> | Buffer | undefined = undefined;

  if (method !== 'get' && method !== 'head') {
    body = new fetchAPI.ReadableStream<Uint8Array>({
      start(streamCtrl) {
        controller.signal.addEventListener(
          'abort',
          () => {
            streamCtrl.error(controller.signal.reason);
          },
          { once: true },
        );
        if (res.onDataV2) {
          let preAllocatedBuffer: Buffer | undefined;
          let writeOffset = 0;
          res.onDataV2((chunk, maxRemainingBodyLength) => {
            const chunkLength = chunk?.byteLength || 0;
            if (preAllocatedBuffer == null) {
              const totalLength = BigInt(chunkLength) + maxRemainingBodyLength;
              if (totalLength <= MAX_BUFFER_LENGTH) {
                preAllocatedBuffer = Buffer.allocUnsafe(
                  Number(maxRemainingBodyLength) + chunkLength,
                );
              }
            }
            if (chunk != null && chunkLength) {
              const chunkBuffer = Buffer.from(chunk, 0, chunkLength);
              if (preAllocatedBuffer != null) {
                chunkBuffer.copy(preAllocatedBuffer, writeOffset);
                streamCtrl.enqueue(
                  preAllocatedBuffer.subarray(writeOffset, writeOffset + chunkLength),
                );
                writeOffset += chunkLength;
              } else {
                streamCtrl.enqueue(Buffer.from(chunkBuffer));
              }
            }
            if (maxRemainingBodyLength === ZERO_BIGINT) {
              if (preAllocatedBuffer != null) {
                body = preAllocatedBuffer;
              }
              streamCtrl.close();
            }
          });
        } else {
          res.onData((chunk, isLast) => {
            if (chunk != null) {
              streamCtrl.enqueue(Buffer.from(Buffer.from(chunk, 0, chunk.byteLength)));
            }
            if (isLast) {
              streamCtrl.close();
            }
          });
        }
      },
    });
  }
  return new fetchAPI.Request(url, {
    method,
    headers,
    signal: controller.signal,
    body,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - not in the TS types yet
    duplex: body ? 'half' : undefined,
  });
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
    uwsResponse.cork(() => {
      uwsResponse.writeStatus('404 Not Found');
      uwsResponse.end();
    });
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
    if (bufferOfRes) {
      uwsResponse.end(bufferOfRes);
    } else if (strBody) {
      uwsResponse.end(strBody);
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
  // @ts-expect-error - It is the part of our ponyfill
  const asyncIterable = fetchResponse.body._iterable as AsyncIterable<Uint8Array> | undefined;
  if (asyncIterable) {
    // @ts-expect-error - It is the part of our ponyfill
    const iterator = fetchResponse.body._activeIterator || asyncIterable[Symbol.asyncIterator]();
    const pump = (): MaybePromise<void> =>
      handleMaybePromise(
        () => iterator.next(),
        sourceResult => {
          if (controller.signal.aborted || sourceResult.done) {
            return uwsResponse.cork(() => {
              uwsResponse.end(sourceResult.value);
            });
          }
          uwsResponse.cork(() => {
            uwsResponse.write(sourceResult.value);
          });
          return pump();
        },
      );
    return pump();
  }
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
