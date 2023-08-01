export interface Cookie {
  domain?: string | undefined;
  expires?: number | undefined;
  name: string;
  path?: string | undefined;
  secure?: boolean | undefined;
  sameSite?: CookieSameSite | undefined;
  value: string;
  httpOnly?: boolean | undefined;
}

export interface CookieStoreDeleteOptions {
  name: string;
  domain?: string | undefined;
  path?: string | undefined;
}

export interface CookieStoreGetOptions {
  name?: string | undefined;
  url?: string | undefined;
}

export type CookieSameSite = 'strict' | 'lax' | 'none';

export interface CookieListItem {
  name?: string | undefined;
  value?: string | undefined;
  domain: string | null;
  path?: string | undefined;
  expires: Date | number | null;
  secure?: boolean | undefined;
  sameSite?: CookieSameSite | undefined;
  httpOnly?: boolean | undefined;
}

export type CookieList = CookieListItem[];

export interface CookieChangeEventInit extends EventInit {
  changed: CookieList;
  deleted: CookieList;
}
