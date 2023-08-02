import type { Readable } from 'node:stream';
import type { FetchAPI } from './types.js';

export interface UWSRequest {
  getMethod(): string;
  forEach(callback: (key: string, value: string) => void): void;
  getUrl(): string;
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
}

class UWSAbortSignal extends EventTarget implements AbortSignal {
  aborted = false;
  _onabort: ((this: AbortSignal, ev: Event) => any) | null = null;
  reason: any;

  throwIfAborted(): void {
    if (this.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
  }

  constructor(res: UWSResponse) {
    super();
    res.onAborted(() => {
      this.aborted = true;
      this.dispatchEvent(new Event('request aborted'));
    });
  }

  get onabort() {
    return this._onabort;
  }

  set onabort(value) {
    this._onabort = value;
    if (value) {
      this.addEventListener('request aborted', value);
    } else {
      this.removeEventListener('request aborted', value);
    }
  }
}

export function getRequestFromUWSRequest({ req, res, fetchAPI }: GetRequestFromUWSOpts) {
  let body: ReadableStream | undefined;
  const method = req.getMethod();
  if (method !== 'get' && method !== 'head') {
    body = new fetchAPI.ReadableStream({});
    const readable = (body as any).readable as Readable;
    res.onAborted(() => {
      readable.push(null);
    });
    let multipleChunks = false;
    res.onData(function (ab, isLast) {
      const chunk = Buffer.from(ab, 0, ab.byteLength);
      if (!multipleChunks && isLast) {
        readable.push(chunk);
      } else {
        readable.push(Buffer.concat([chunk]));
      }
      if (isLast) {
        readable.push(null);
      }
      multipleChunks = true;
    });
  }
  const headers = new fetchAPI.Headers();
  req.forEach((key, value) => {
    headers.set(key, value);
  });
  const url = `http://localhost${req.getUrl()}`;
  return new fetchAPI.Request(url, {
    method,
    headers,
    body: body as any,
    signal: new UWSAbortSignal(res),
  });
}

interface SendResponseToUWSOpts {
  res: UWSResponse;
  response: Response;
}

async function forwardResponseBodyToUWSResponse({ res, response }: SendResponseToUWSOpts) {
  let resAborted = false;
  res.onAborted(function () {
    resAborted = true;
  });

  for await (const chunk of response.body as any as AsyncIterable<Uint8Array>) {
    if (resAborted) {
      return;
    }
    res.cork(() => {
      res.write(chunk);
    });
  }
  res.cork(() => {
    res.end();
  });
}

export function sendResponseToUwsOpts({ res, response }: SendResponseToUWSOpts) {
  const isStringOrBuffer =
    (response as any).bodyType === 'Buffer' ||
    (response as any).bodyType === 'String' ||
    (response as any).bodyType === 'Uint8Array';
  res.cork(() => {
    res.writeStatus(`${response.status} ${response.statusText}`);
    for (const [key, value] of response.headers) {
      // content-length causes an error with Node.js's fetch
      if (key !== 'content-length') {
        if (key === 'set-cookie') {
          const setCookies = response.headers.getSetCookie?.();
          if (setCookies) {
            for (const setCookie of setCookies) {
              res.writeHeader(key, setCookie);
            }
            continue;
          }
        }
        res.writeHeader(key, value);
      }
    }
    if (isStringOrBuffer) {
      res.end((response as any).bodyInit);
    }
  });
  if (isStringOrBuffer) {
    return;
  }
  if (!response.body) {
    res.end();
    return;
  }
  return forwardResponseBodyToUWSResponse({ res, response });
}
