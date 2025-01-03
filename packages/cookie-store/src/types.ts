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
  name?: string | undefined;
  url?: string;
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
