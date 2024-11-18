import { resolveObjectURL } from 'buffer';
import { randomUUID } from 'crypto';
import FastQuerystring from 'fast-querystring';
import FastUrl from '@kamilkisiela/fast-url-parser';
import { PonyfillBlob } from './Blob.js';
import { PonyfillURLSearchParams } from './URLSearchParams.js';

FastUrl.queryString = FastQuerystring;

class PonyfillURL extends FastUrl {
  constructor(url: string | URL, base?: string | URL | undefined) {
    url = url.toString();
    super();
    if (url.startsWith('data:')) {
      this.protocol = 'data:';
      this.pathname = url.slice('data:'.length);
      return;
    }
    this.parse(url, false);
    if (base) {
      const baseParsed = typeof base === 'string' ? new PonyfillURL(base) : base;
      this.protocol = this.protocol || baseParsed.protocol;
      this.host = this.host || baseParsed.host;
      this.pathname = this.pathname || baseParsed.pathname;
    }
  }

  canParse(url: string, base?: string): boolean {
    try {
      // eslint-disable-next-line no-new
      new PonyfillURL(url, base);
      return true;
    } catch {
      return false;
    }
  }

  get origin(): string {
    return `${this.protocol}//${this.host}`;
  }

  private _searchParams?: PonyfillURLSearchParams;

  get searchParams(): PonyfillURLSearchParams {
    if (!this._searchParams) {
      this._searchParams = new PonyfillURLSearchParams(this.query);
    }
    return this._searchParams;
  }

  get username(): string {
    return this.auth?.split(':')[0] || '';
  }

  set username(value: string) {
    this.auth = `${value}:${this.password}`;
  }

  get password(): string {
    return this.auth?.split(':')[1] || '';
  }

  set password(value: string) {
    this.auth = `${this.username}:${value}`;
  }

  toString(): string {
    return this.format();
  }

  toJSON(): string {
    return this.toString();
  }

  private static blobRegistry = new Map<string, Blob>();

  createObjectURL(obj: Blob): string {
    return PonyfillURL.createObjectURL(obj);
  }

  revokeObjectURL(url: string): void {
    PonyfillURL.resolveObjectURL(url);
  }

  static createObjectURL(blob: Blob): string {
    const blobUrl = `blob:whatwgnode:${randomUUID()}`;
    this.blobRegistry.set(blobUrl, blob);
    return blobUrl;
  }

  static resolveObjectURL(url: string): void {
    if (!this.blobRegistry.has(url)) {
      URL.revokeObjectURL(url);
    } else {
      this.blobRegistry.delete(url);
    }
  }

  static getBlobFromURL(url: string): Blob | PonyfillBlob | undefined {
    return (this.blobRegistry.get(url) || resolveObjectURL(url)) as Blob | PonyfillBlob | undefined;
  }
}

const URLCtor = PonyfillURL as unknown as typeof URL;

export { URLCtor as PonyfillURL };
