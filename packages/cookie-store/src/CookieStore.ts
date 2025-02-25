import { fakePromise } from '@whatwg-node/promise-helpers';
import { CookieChangeEvent } from './CookieChangeEvent.js';
import { parse } from './parse.js';
import {
  Cookie,
  CookieListItem,
  CookieStoreDeleteOptions,
  CookieStoreGetOptions,
} from './types.js';

export class CookieStore extends EventTarget {
  onchange?: (event: CookieChangeEvent) => void;

  private cookieMap = new Map<string, Cookie>();

  get [Symbol.toStringTag](): 'CookieStore' {
    return 'CookieStore';
  }

  constructor(cookieString: string) {
    super();
    this.cookieMap = parse(cookieString);
  }

  get(
    init?: CookieStoreGetOptions['name'] | CookieStoreGetOptions | undefined,
  ): Promise<Cookie | undefined> {
    if (init == null) {
      throw new TypeError('CookieStoreGetOptions must not be empty');
    } else if (init instanceof Object && !Object.keys(init).length) {
      throw new TypeError('CookieStoreGetOptions must not be empty');
    }
    return this.getAll(init).then(cookies => cookies[0]);
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
      httpOnly: false,
    };
    if (typeof init === 'string') {
      item.name = init as string;
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
    const previousCookie = await this.get(item.name);
    this.cookieMap.set(item.name || '', item as Cookie);

    if (this.onchange) {
      const changed = [];
      const deleted = [];

      if (previousCookie && !(await this.get(item))) {
        deleted.push({ ...item, value: undefined });
      } else {
        changed.push(item);
      }
      const event = new CookieChangeEvent('change', { changed, deleted });
      this.onchange(event);
    }
  }

  getAll(init?: CookieStoreGetOptions['name'] | CookieStoreGetOptions): Promise<Cookie[]> {
    const cookies = Array.from(this.cookieMap.values());
    if (init == null || Object.keys(init).length === 0) {
      return fakePromise(cookies);
    }
    let name: string | undefined;
    if (typeof init === 'string') {
      name = init as string;
    } else {
      name = init.name;
    }
    return fakePromise(cookies.filter(cookie => cookie.name === name));
  }

  delete(init: CookieStoreDeleteOptions['name'] | CookieStoreDeleteOptions): Promise<void> {
    const item: CookieListItem = {
      name: '',
      value: '',
      path: '/',
      secure: false,
      sameSite: 'strict',
      expires: null,
      domain: null,
      httpOnly: false,
    };
    if (typeof init === 'string') {
      item.name = init as string;
    } else {
      Object.assign(item, init);
    }

    item.expires = 0;

    return this.set(item);
  }
}
