import type { Readable } from 'node:stream';
import type { FetchAPI } from './types.js';
import { ServerAdapterRequestAbortSignal } from './utils.js';

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
      readable.push(Buffer.from(chunk));
      if (isLast) {
        readable.push(null);
      }
      multipleChunks = true;
    });
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
  return new fetchAPI.Request(url, {
    method,
    headers,
    body: body as any,
    signal: new ServerAdapterRequestAbortSignal(),
  });
}

async function forwardResponseBodyToUWSResponse(uwsResponse: UWSResponse, fetchResponse: Response) {
  let resAborted = false;
  uwsResponse.onAborted(function () {
    resAborted = true;
  });

  for await (const chunk of fetchResponse.body as any as AsyncIterable<Uint8Array>) {
    if (resAborted) {
      return;
    }
    uwsResponse.cork(() => {
      uwsResponse.write(chunk);
    });
  }
  uwsResponse.cork(() => {
    uwsResponse.end();
  });
}

export function sendResponseToUwsOpts(uwsResponse: UWSResponse, fetchResponse: Response) {
  if (!fetchResponse) {
    uwsResponse.writeStatus('404 Not Found');
    uwsResponse.end();
    return;
  }
  const bufferOfRes: Uint8Array = (fetchResponse as any)._buffer;
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
    if (bufferOfRes) {
      uwsResponse.end(bufferOfRes);
    }
  });
  if (bufferOfRes) {
    return;
  }
  if (!fetchResponse.body) {
    uwsResponse.end();
    return;
  }
  return forwardResponseBodyToUWSResponse(uwsResponse, fetchResponse);
}
