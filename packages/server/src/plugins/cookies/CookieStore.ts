import { CookieChangeEvent } from './CookieChangeEvent';
import { parse } from './parse';
import { Cookie, CookieListItem, CookieStoreDeleteOptions, CookieStoreGetOptions } from './types';

export class CookieStore extends EventTarget {
  onchange?: (event: CookieChangeEvent) => void;

  get [Symbol.toStringTag](): 'CookieStore' {
    return 'CookieStore';
  }

  constructor(public cookieString: string) {
    super();
  }

  async get(
    init?: CookieStoreGetOptions['name'] | CookieStoreGetOptions,
  ): Promise<Cookie | undefined> {
    if (init == null) {
      throw new TypeError('CookieStoreGetOptions must not be empty');
    } else if (init instanceof Object && !Object.keys(init).length) {
      throw new TypeError('CookieStoreGetOptions must not be empty');
    }
    return (await this.getAll(init))[0];
  }

  async set(init: CookieListItem | string, possibleValue?: string): Promise<void> {
    const item: CookieListItem = {
      name: '',
      value: '',
      path: '/',
      secure: false,
      sameSite: 'strict',
      expires: null,
      domain: null,
    };
    if (typeof init === 'string') {
      item.name = init as string;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      item.value = possibleValue!;
    } else {
      Object.assign(item, init);

      if (item.path && !item.path.startsWith('/')) {
        throw new TypeError('Cookie path must start with "/"');
      }
      if (item.domain?.startsWith('.')) {
        throw new TypeError('Cookie domain cannot start with "."');
      }

      if (item.name?.startsWith('__Host') && item.domain) {
        throw new TypeError('Cookie domain must not be specified for host cookies');
      }
      if (item.name?.startsWith('__Host') && item.path !== '/') {
        throw new TypeError('Cookie path must not be specified for host cookies');
      }

      if (item.path && item.path.endsWith('/')) {
        item.path = item.path.slice(0, -1);
      }
      if (item.path === '') {
        item.path = '/';
      }
    }

    if (item.name === '' && item.value && item.value.includes('=')) {
      throw new TypeError("Cookie value cannot contain '=' if the name is empty");
    }

    if (item.name && item.name.startsWith('__Host')) {
      item.secure = true;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let cookieString = `${item.name}=${encodeURIComponent(item.value!)}`;

    if (item.domain) {
      cookieString += '; Domain=' + item.domain;
    }

    if (item.path) {
      cookieString += '; Path=' + item.path;
    }

    if (typeof item.expires === 'number') {
      cookieString += '; Expires=' + new Date(item.expires).toUTCString();
    } else if (item.expires instanceof Date) {
      cookieString += '; Expires=' + item.expires.toUTCString();
    }

    if ((item.name && item.name.startsWith('__Secure')) || item.secure) {
      item.sameSite = 'lax';
      cookieString += '; Secure';
    }

    switch (item.sameSite) {
      case 'lax':
        cookieString += '; SameSite=Lax';
        break;
      case 'strict':
        cookieString += '; SameSite=Strict';
        break;
      case 'none':
        cookieString += '; SameSite=None';
        break;
    }

    const previousCookie = await this.get(item);
    this.cookieString = cookieString;

    if (this.onchange) {
      const changed = [];
      const deleted = [];

      if (previousCookie && !(await this.get(item))) {
        deleted.push({ ...item, value: undefined });
      } else {
        changed.push(item);
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const event = new CookieChangeEvent('change', { changed, deleted });
      this.onchange(event);
    }
  }

  async getAll(init?: CookieStoreGetOptions['name'] | CookieStoreGetOptions): Promise<Cookie[]> {
    const cookies = parse(this.cookieString);
    if (init == null || Object.keys(init).length === 0) {
      return cookies;
    }
    let name: string | undefined;
    if (typeof init === 'string') {
      name = init as string;
    } else {
      name = init.name;
    }
    return cookies.filter(cookie => cookie.name === name);
  }

  async delete(init: CookieStoreDeleteOptions['name'] | CookieStoreDeleteOptions): Promise<void> {
    const item: CookieListItem = {
      name: '',
      value: '',
      path: '/',
      secure: false,
      sameSite: 'strict',
      expires: null,
      domain: null,
    };
    if (typeof init === 'string') {
      item.name = init as string;
    } else {
      Object.assign(item, init);
    }

    item.expires = 0;

    await this.set(item);
  }
}
