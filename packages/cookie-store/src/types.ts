export interface Cookie {
  domain?: string;
  expires?: number;
  name: string;
  path?: string;
  secure?: boolean;
  sameSite?: CookieSameSite;
  value: string;
  httpOnly?: boolean;
}

export interface CookieStoreDeleteOptions {
  name: string;
  domain?: string;
  path?: string;
}

export interface CookieStoreGetOptions {
  name?: string;
  url?: string;
}

export type CookieSameSite = 'strict' | 'lax' | 'none';

export interface CookieListItem {
  name?: string;
  value?: string;
  domain: string | null;
  path?: string;
  expires: Date | number | null;
  secure?: boolean;
  sameSite?: CookieSameSite;
  httpOnly?: boolean;
}

export type CookieList = CookieListItem[];

export interface CookieChangeEventInit extends EventInit {
  changed: CookieList;
  deleted: CookieList;
}
