import FastQuerystring from 'fast-querystring';
import FastUrl from '@kamilkisiela/fast-url-parser';
import { PonyfillURLSearchParams } from './URLSearchParams.js';

FastUrl.queryString = FastQuerystring;

export class PonyfillURL extends FastUrl implements URL {
  constructor(url: string, base?: string | URL) {
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
}
