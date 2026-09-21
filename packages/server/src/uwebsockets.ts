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

const uwsDrainUnreadBodyByRequest = new WeakMap<Request, () => void>();

/**
 * If the handler never read the body, stop retaining upload chunks while keeping the
 * existing `onData` subscription so uWS can finish delivering the request.
 */
export function discardUnreadUWSRequestBody(request: Request) {
  uwsDrainUnreadBodyByRequest.get(request)?.();
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

  // uWebSockets.js requires onData to be attached synchronously before any await in the
  // route handler; otherwise upload chunks can be lost. Always subscribe (including GET/HEAD
  // so empty-body completion still marks `stopped` for text/json helpers), then
  // {@link discardUnreadUWSRequestBody} can stop retaining chunks if unused.
  let discarding = false;
  // bodyHeld: body was obtained or a consumer was attached — skip unread discard.
  // bodyConsumed: Fetch `bodyUsed` — true only after a body method runs or a stream is locked.
  let bodyHeld = false;
  let bodyConsumed = false;

  res.onData(function (ab, isLast) {
    if (!discarding && !stopped) {
      push(Buffer.from(Buffer.from(ab, 0, ab.byteLength)));
    }
    if (isLast) {
      stop();
    }
  });

  function createChunkReadableStream(): ReadableStream {
    return new fetchAPI.ReadableStream({
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
    getReadableStream = createChunkReadableStream;
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
  // Do not pass `body` in Request init: some Fetch implementations read it during construction
  // and would start consuming before the handler runs.
  const request = new fetchAPI.Request(url, {
    method,
    headers,
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
    bodyHeld = true;
    bodyConsumed = true;
    if (!getReadableStream) {
      return fakePromise(Buffer.alloc(0));
    }
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
  function isBodyUsed(stream: ReadableStream | undefined) {
    return bodyConsumed || !!stream?.locked;
  }
  function installBodyAccessors(target: Request) {
    // Each Request (original vs clone) gets its own stream so consumers do not share one branch.
    let readableStream: ReadableStream | undefined;
    function getBody() {
      if (!getReadableStream) {
        return null;
      }
      bodyHeld = true;
      if (stopped) {
        return getBufferFromChunks();
      }
      if (!readableStream) {
        readableStream = createChunkReadableStream();
      }
      return readableStream;
    }
    Object.defineProperties(target, {
      body: {
        get() {
          return getBody();
        },
        configurable: true,
        enumerable: true,
      },
      bodyUsed: {
        get() {
          return isBodyUsed(readableStream);
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
      bytes: {
        value() {
          return collectBuffer().then(b => new Uint8Array(b));
        },
        configurable: true,
        enumerable: true,
      },
      blob: {
        value() {
          return collectBuffer().then(b => new fetchAPI.Blob([new Uint8Array(b)]));
        },
        configurable: true,
        enumerable: true,
      },
      formData: {
        value() {
          bodyHeld = true;
          bodyConsumed = true;
          if (!getReadableStream) {
            return fakePromise(new fetchAPI.FormData());
          }
          // Stream path so abort rejects with aborted/closed instead of parsing a partial body.
          return new fetchAPI.Request(url, {
            method: method || 'POST',
            headers,
            body: getBody(),
            signal: controller.signal,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - not in the TS types yet
            duplex: 'half',
          }).formData();
        },
        configurable: true,
        enumerable: true,
      },
      clone: {
        value() {
          if (isBodyUsed(readableStream)) {
            throw new TypeError('Body has already been consumed.');
          }
          const cloned = new fetchAPI.Request(url, {
            method,
            headers,
            signal: controller.signal,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - not in the TS types yet
            duplex,
          });
          installBodyAccessors(cloned);
          if (getReadableStream) {
            uwsDrainUnreadBodyByRequest.set(cloned, () => {
              if (bodyHeld) {
                return;
              }
              discarding = true;
              chunks.length = 0;
              buffer = undefined;
            });
          }
          return cloned;
        },
        configurable: true,
        enumerable: true,
      },
    });
  }
  installBodyAccessors(request);
  if (getReadableStream) {
    uwsDrainUnreadBodyByRequest.set(request, () => {
      if (bodyHeld) {
        return;
      }
      // Keep onData attached (uWS may still deliver chunks after end) but stop retaining them.
      discarding = true;
      chunks.length = 0;
      buffer = undefined;
    });
  }
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
    let isSetCookieHandled = false;
    for (const [key, value] of fetchResponse.headers) {
      // content-length causes an error with Node.js's fetch
      // transfer-encoding is handled automatically by uWebSockets.js
      if (key !== 'content-length' && key !== 'transfer-encoding') {
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
