import { fakePromise } from '@whatwg-node/promise-helpers';
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
}: GetRequestFromUWSOpts) {
  const method = req.getMethod();

  let duplex: 'half' | undefined;

  const chunks: Buffer<ArrayBuffer>[] = [];
  const pushFns = [
    (chunk: Buffer<ArrayBuffer>) => {
      chunks.push(chunk);
    },
  ];
  const push = (chunk: Buffer<ArrayBuffer>) => {
    for (const pushFn of pushFns) {
      pushFn(chunk);
    }
  };
  let stopped = false;
  const stopFns = [
    () => {
      stopped = true;
    },
  ];
  const stop = () => {
    for (const stopFn of stopFns) {
      stopFn();
    }
  };
  res.onData(function (ab, isLast) {
    push(Buffer.from(Buffer.from(ab, 0, ab.byteLength)));
    if (isLast) {
      stop();
    }
  });
  let getReadableStream: (() => ReadableStream) | undefined;
  if (method !== 'get' && method !== 'head') {
    duplex = 'half';
    controller.signal.addEventListener(
      'abort',
      () => {
        stop();
      },
      { once: true },
    );
    let readableStream: ReadableStream;
    getReadableStream = () => {
      if (!readableStream) {
        readableStream = new fetchAPI.ReadableStream({
          start(streamCtrl) {
            for (const chunk of chunks) {
              streamCtrl.enqueue(chunk);
            }
            if (stopped) {
              streamCtrl.close();
              return;
            }
            pushFns.push((chunk: Buffer) => {
              streamCtrl.enqueue(chunk);
            });
            stopFns.push(() => {
              if (controller.signal.reason) {
                streamCtrl.error(controller.signal.reason);
                return;
              }
              if (streamCtrl.desiredSize) {
                streamCtrl.close();
              }
            });
          },
        });
      }
      return readableStream;
    };
  }
  const headers = new fetchAPI.Headers();
  req.forEach((key, value) => {
    headers.append(key, value);
  });
  let url = `http://localhost${req.getUrl()}`;
  const query = req.getQuery();
  if (query) {
    url += `?${query}`;
  }
  let buffer: Buffer<ArrayBuffer> | undefined;
  function getBody() {
    if (!getReadableStream) {
      return null;
    }
    if (stopped) {
      return getBufferFromChunks();
    }
    return getReadableStream();
  }
  const request = new fetchAPI.Request(url, {
    method,
    headers,
    get body() {
      return getBody();
    },
    signal: controller.signal,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - not in the TS types yet
    duplex,
  });
  function getBufferFromChunks(): Buffer<ArrayBuffer> {
    if (!buffer) {
      buffer = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
    }
    return buffer;
  }
  function collectBuffer() {
    if (stopped) {
      return fakePromise(getBufferFromChunks());
    }
    return new Promise<Buffer>((resolve, reject) => {
      try {
        stopFns.push(() => {
          resolve(getBufferFromChunks());
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  Object.defineProperties(request, {
    body: {
      get() {
        return getBody();
      },
      configurable: true,
      enumerable: true,
    },
    json: {
      value() {
        return collectBuffer()
          .then(b => b.toString('utf8'))
          .then(t => JSON.parse(t));
      },
      configurable: true,
      enumerable: true,
    },
    text: {
      value() {
        return collectBuffer().then(b => b.toString('utf8'));
      },
      configurable: true,
      enumerable: true,
    },
    arrayBuffer: {
      value() {
        return collectBuffer();
      },
      configurable: true,
      enumerable: true,
    },
  });
  return request;
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
    for (const [key, value] of fetchResponse.headers) {
      // content-length causes an error with Node.js's fetch
      if (key !== 'content-length') {
        if (key === 'set-cookie') {
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
