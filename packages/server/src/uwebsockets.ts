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
    },
    values() {
      const values: string[] = [];
      this.forEach(value => {
        values.push(value);
      });
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
