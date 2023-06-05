import { Repeater } from '@repeaterjs/repeater';
import type { FetchAPI } from './types.js';

export interface UWSRequest {
  getMethod(): string;
  forEach(callback: (key: string, value: string) => void): void;
  getUrl(): string;
  getHeader(key: string): string | undefined;
}

export interface UWSResponse {
  onData(callback: (chunk: ArrayBuffer, isLast: boolean) => void): void;
  onAborted(callback: () => void): void;
  writeStatus(status: string): void;
  writeHeader(key: string, value: string): void;
  end(body?: any): void;
  write(body: any): boolean;
  cork(callback: () => void): void;
}

export type UWSHandler = (res: UWSResponse, req: UWSRequest) => void | Promise<void>;

export function isUWSResponse(res: any): res is UWSResponse {
  return typeof res === 'object' && typeof res.onData === 'function';
}

function throwReadOnlyHeadersError() {
  throw new Error('You cannot modify headers for a read-only request');
}

export function getHeadersFromUWSRequest(req: UWSRequest): Headers {
  return {
    append() {
      throwReadOnlyHeadersError();
    },
    delete() {
      throwReadOnlyHeadersError();
    },
    get(key: string) {
      return req.getHeader(key) || null;
    },
    has(key: string) {
      return req.getHeader(key) != null;
    },
    set() {
      throwReadOnlyHeadersError();
    },
    forEach(callback: (value: string, key: string, parent: Headers) => void) {
      req.forEach((key, value) => callback(value, key, this));
    },
    entries() {
      const entries: [string, string][] = [];
      this.forEach((value, key) => {
        entries.push([key, value]);
      });
      return entries[Symbol.iterator]();
    },
    keys() {
      const keys: string[] = [];
      this.forEach((_, key) => {
        keys.push(key);
      });
      return keys[Symbol.iterator]();
    },
    values() {
      const values: string[] = [];
      this.forEach(value => {
        values.push(value);
      });
      return values[Symbol.iterator]();
    },
    [Symbol.iterator]() {
      const entries: [string, string][] = [];
      this.forEach((value, key) => {
        entries.push([key, value]);
      });
      return entries[Symbol.iterator]();
    },
  };
}

interface GetRequestFromUWSOpts {
  req: UWSRequest;
  res: UWSResponse;
  fetchAPI: FetchAPI;
}

export function getRequestFromUWSRequest({ req, res, fetchAPI }: GetRequestFromUWSOpts) {
  let body: Repeater<Buffer> | undefined;
  const method = req.getMethod();
  if (method !== 'get' && method !== 'head') {
    body = new Repeater(function (push, stop) {
      res.onAborted(stop);
      res.onData(function (chunk, isLast) {
        push(Buffer.from(chunk));
        if (isLast) {
          stop();
        }
      });
    });
  }
  const headers = getHeadersFromUWSRequest(req);
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
    if (key.toLowerCase() !== 'content-length') {
      res.cork(() => {
        res.writeHeader(key, value);
      });
    }
  });
  if (!response.body) {
    res.end();
    return;
  }
  if ((response as any).bodyType === 'String' || (response as any).bodyType === 'Uint8Array') {
    res.cork(() => {
      res.end((response as any).bodyInit);
    });
    return;
  }
  for await (const chunk of (response.body as any).readable) {
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
