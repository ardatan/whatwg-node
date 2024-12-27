import { resolveObjectURL } from 'buffer';
import { randomUUID } from 'crypto';
import FastQuerystring from 'fast-querystring';
import FastUrl from '@kamilkisiela/fast-url-parser';
import { PonyfillBlob } from './Blob.js';
import { PonyfillURLSearchParams } from './URLSearchParams.js';

FastUrl.queryString = FastQuerystring;

const IPV6_REGEX =
  /^(?:(?:(?:[0-9A-Fa-f]{1,4}:){6}(?:[0-9A-Fa-f]{1,4}:[0-9A-Fa-f]{1,4}|(?:(?:0?0?[0-9]|0?[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\.){3}(?:0?0?[0-9]|0?[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5]))|::(?:[0-9A-Fa-f]{1,4}:){5}(?:[0-9A-Fa-f]{1,4}:[0-9A-Fa-f]{1,4}|(?:(?:0?0?[0-9]|0?[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\.){3}(?:0?0?[0-9]|0?[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5]))|(?:[0-9A-Fa-f]{1,4})?::(?:[0-9A-Fa-f]{1,4}:){4}(?:[0-9A-Fa-f]{1,4}:[0-9A-Fa-f]{1,4}|(?:(?:0?0?[0-9]|0?[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\.){3}(?:0?0?[0-9]|0?[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5]))|(?:(?:[0-9A-Fa-f]{1,4}:){0,1}[0-9A-Fa-f]{1,4})?::(?:[0-9A-Fa-f]{1,4}:){3}(?:[0-9A-Fa-f]{1,4}:[0-9A-Fa-f]{1,4}|(?:(?:0?0?[0-9]|0?[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\.){3}(?:0?0?[0-9]|0?[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5]))|(?:(?:[0-9A-Fa-f]{1,4}:){0,2}[0-9A-Fa-f]{1,4})?::(?:[0-9A-Fa-f]{1,4}:){2}(?:[0-9A-Fa-f]{1,4}:[0-9A-Fa-f]{1,4}|(?:(?:0?0?[0-9]|0?[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\.){3}(?:0?0?[0-9]|0?[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5]))|(?:(?:[0-9A-Fa-f]{1,4}:){0,3}[0-9A-Fa-f]{1,4})?::[0-9A-Fa-f]{1,4}:(?:[0-9A-Fa-f]{1,4}:[0-9A-Fa-f]{1,4}|(?:(?:0?0?[0-9]|0?[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\.){3}(?:0?0?[0-9]|0?[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5]))|(?:(?:[0-9A-Fa-f]{1,4}:){0,4}[0-9A-Fa-f]{1,4})?::(?:[0-9A-Fa-f]{1,4}:[0-9A-Fa-f]{1,4}|(?:(?:0?0?[0-9]|0?[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\.){3}(?:0?0?[0-9]|0?[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5]))|(?:(?:[0-9A-Fa-f]{1,4}:){0,5}[0-9A-Fa-f]{1,4})?::[0-9A-Fa-f]{1,4}|(?:(?:[0-9A-Fa-f]{1,4}:){0,6}[0-9A-Fa-f]{1,4})?::)(?:\/(?:0?0?[0-9]|0?[1-9][0-9]|1[01][0-9]|12[0-8]))?)$/;

export class PonyfillURL extends FastUrl implements URL {
  constructor(url: string, base?: string | URL) {
    super();
    if (url.startsWith('data:')) {
      this.protocol = 'data:';
      this.pathname = url.slice('data:'.length);
      return;
    }
    this.parse(url, false);
    // `fast-url-parser` incorrectly removes `[IPV6]` in the hostname
    // Then `hostname` doesn't include `[` and `]` for IPv6 URLs
    // This breaks implementations that rely on `hostname` to include `[` and `]`
    if (
      (url.startsWith('http://[') || url.startsWith('https://[')) &&
      IPV6_REGEX.test(this.hostname)
    ) {
      this.hostname = `[${this.hostname}]`;
    }
    // `fast-url-parser` incorrectly handle URLs with ports without pathnames correctly like
    // `http://localhost:8080?foo=bar` -> `http://localhost/:8080?foo=bar`
    if (url.includes(`${this.hostname}:`) && !this.port && this.pathname.startsWith('/:')) {
      this.port = this.pathname.slice(2);
      this.pathname = '/';
      this.host = `${this.hostname}:${this.port}`;
    }
    if (base) {
      const baseParsed = typeof base === 'string' ? new PonyfillURL(base) : base;
      this.protocol ||= baseParsed.protocol;
      this.host ||= baseParsed.host;
      this.pathname ||= baseParsed.pathname;
      this.port ||= baseParsed.port;
    }
  }

  get origin(): string {
    return `${this.protocol}//${this.hostname}${this.port ? `:${this.port}` : ''}`;
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
    if (this._searchParams) {
      this.search = this._searchParams.toString();
    }
    return this.format();
  }

  toJSON(): string {
    return this.toString();
  }

  private static blobRegistry = new Map<string, Blob>();

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

  [Symbol.toStringTag] = 'URL';
}
