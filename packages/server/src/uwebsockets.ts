import type { Readable } from 'node:stream';
import type { FetchAPI } from './types.js';
import { splitSetCookieHeader } from './utils.js';

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

export function getRequestFromUWSRequest({ req, res, fetchAPI }: GetRequestFromUWSOpts) {
  let body: ReadableStream | undefined;
  const method = req.getMethod();
  if (method !== 'get' && method !== 'head') {
    body = new fetchAPI.ReadableStream({});
    const readable = (body as any).readable as Readable;
    res.onAborted(() => {
      readable.push(null);
    });
    res.onData(function (chunk, isLast) {
      readable.push(Buffer.from(chunk, 0, chunk.byteLength));
      if (isLast) {
        readable.push(null);
      }
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
  });
}

interface SendResponseToUWSOpts {
  res: UWSResponse;
  response: Response;
}

export async function sendResponseToUwsOpts({ res, response }: SendResponseToUWSOpts) {
  let resAborted = false;
  res.onAborted(function () {
    resAborted = true;
  });
  res.cork(() => {
    res.writeStatus(`${response.status} ${response.statusText}`);
  });
  response.headers.forEach((value, key) => {
    // content-length causes an error with Node.js's fetch
    if (key !== 'content-length') {
      if (key === 'set-cookie') {
        const setCookieHeaders = splitSetCookieHeader(value);
        setCookieHeaders.forEach(setCookieHeader => {
          res.cork(() => {
            res.writeHeader(key, setCookieHeader);
          });
        });
        return;
      }
      res.cork(() => {
        res.writeHeader(key, value);
      });
    }
  });
  if ((response as any).bodyType === 'String' || (response as any).bodyType === 'Uint8Array') {
    res.cork(() => {
      res.end((response as any).bodyInit);
    });
    return;
  }
  if (!response.body) {
    res.end();
    return;
  }
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
