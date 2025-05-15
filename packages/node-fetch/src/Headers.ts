import { inspect } from 'node:util';
import { PonyfillIteratorObject } from './IteratorObject.js';

export type PonyfillHeadersInit = [string, string][] | Record<string, string> | Headers;

export function isHeadersLike(headers: any): headers is Headers {
  return headers?.get && headers?.forEach;
}

export class PonyfillHeaders implements Headers {
  private _map: Map<string, string> | undefined;
  private objectNormalizedKeysOfHeadersInit: string[] = [];
  private objectOriginalKeysOfHeadersInit: string[] = [];
  private _setCookies?: string[];

  constructor(private headersInit?: PonyfillHeadersInit) {}

  // perf: we don't need to build `this.map` for Requests, as we can access the headers directly
  private _get(key: string) {
    const normalized = key.toLowerCase();
    if (normalized === 'set-cookie' && this._setCookies?.length) {
      return this._setCookies.join(', ');
    }
    // If the map is built, reuse it
    if (this._map) {
      return this._map.get(normalized) || null;
    }

    // If the map is not built, try to get the value from the this.headersInit
    if (this.headersInit == null) {
      return null;
    }

    if (Array.isArray(this.headersInit)) {
      const found = this.headersInit.filter(
        ([headerKey]) => headerKey.toLowerCase() === normalized,
      );
      if (found.length === 0) {
        return null;
      }
      if (found.length === 1) {
        return found[0][1];
      }
      return found.map(([, value]) => value).join(', ');
    } else if (isHeadersLike(this.headersInit)) {
      return this.headersInit.get(normalized);
    } else {
      const initValue = this.headersInit[key] || this.headersInit[normalized];

      if (initValue != null) {
        return initValue;
      }

      if (!this.objectNormalizedKeysOfHeadersInit.length) {
        Object.keys(this.headersInit).forEach(k => {
          this.objectOriginalKeysOfHeadersInit.push(k);
          this.objectNormalizedKeysOfHeadersInit.push(k.toLowerCase());
        });
      }
      const index = this.objectNormalizedKeysOfHeadersInit.indexOf(normalized);
      if (index === -1) {
        return null;
      }
      const originalKey = this.objectOriginalKeysOfHeadersInit[index];
      return this.headersInit[originalKey];
    }
  }

  // perf: Build the map of headers lazily, only when we need to access all headers or write to it.
  // I could do a getter here, but I'm too lazy to type `getter`.
  private getMap() {
    if (!this._map) {
      this._setCookies = [];
      if (this.headersInit != null) {
        if (Array.isArray(this.headersInit)) {
          this._map = new Map();
          for (const [key, value] of this.headersInit) {
            const normalizedKey = key.toLowerCase();
            if (normalizedKey === 'set-cookie') {
              this._setCookies.push(value);
              continue;
            }
            this._map.set(normalizedKey, value);
          }
        } else if (isHeadersLike(this.headersInit)) {
          this._map = new Map();
          this.headersInit.forEach((value, key) => {
            if (key === 'set-cookie') {
              this._setCookies ||= [];
              this._setCookies.push(value);
              return;
            }
            this._map!.set(key, value);
          });
        } else {
          this._map = new Map();
          for (const initKey in this.headersInit) {
            const initValue = this.headersInit[initKey];
            if (initValue != null) {
              const normalizedKey = initKey.toLowerCase();
              if (normalizedKey === 'set-cookie') {
                this._setCookies ||= [];
                this._setCookies.push(initValue);
                continue;
              }
              this._map.set(normalizedKey, initValue);
            }
          }
        }
      } else {
        this._map = new Map();
      }
    }

    return this._map;
  }

  append(name: string, value: string): void {
    const key = name.toLowerCase();
    if (key === 'set-cookie') {
      this._setCookies ||= [];
      this._setCookies.push(value);
      return;
    }
    const existingValue = this.getMap().get(key);
    const finalValue = existingValue ? `${existingValue}, ${value}` : value;
    this.getMap().set(key, finalValue);
  }

  get(name: string): string | null {
    const value = this._get(name);

    if (value == null) {
      return null;
    }

    return value.toString();
  }

  has(name: string): boolean {
    if (name === 'set-cookie') {
      return !!this._setCookies?.length;
    }
    return !!this._get(name); // we might need to check if header exists and not just check if it's not nullable
  }

  set(name: string, value: string): void {
    const key = name.toLowerCase();
    if (key === 'set-cookie') {
      this._setCookies = [value];
      return;
    }
    if (this._map) {
      this._map.set(key, value);
      return;
    }
    if (
      this.headersInit != null &&
      !isHeadersLike(this.headersInit) &&
      !Array.isArray(this.headersInit)
    ) {
      this.headersInit[key] = value;
      return;
    }
    this.getMap().set(key, value);
  }

  delete(name: string): void {
    const key = name.toLowerCase();
    if (key === 'set-cookie') {
      this._setCookies = [];
      return;
    }
    this.getMap().delete(key);
  }

  forEach(callback: (value: string, key: string, parent: Headers) => void): void {
    this._setCookies?.forEach(setCookie => {
      callback(setCookie, 'set-cookie', this);
    });
    if (!this._map) {
      if (this.headersInit) {
        if (Array.isArray(this.headersInit)) {
          this.headersInit.forEach(([key, value]) => {
            callback(value, key, this);
          });
          return;
        }
        if (isHeadersLike(this.headersInit)) {
          this.headersInit.forEach(callback);
          return;
        }
        Object.entries(this.headersInit).forEach(([key, value]) => {
          if (value != null) {
            callback(value, key, this);
          }
        });
      }
      return;
    }
    this.getMap().forEach((value, key) => {
      callback(value, key, this);
    });
  }

  *_keys(): IterableIterator<string> {
    if (this._setCookies?.length) {
      yield 'set-cookie';
    }
    if (!this._map) {
      if (this.headersInit) {
        if (Array.isArray(this.headersInit)) {
          yield* this.headersInit.map(([key]) => key)[Symbol.iterator]();
          return;
        }
        if (isHeadersLike(this.headersInit)) {
          yield* this.headersInit.keys();
          return;
        }
        yield* Object.keys(this.headersInit)[Symbol.iterator]();
        return;
      }
    }
    yield* this.getMap().keys();
  }

  keys(): HeadersIterator<string> {
    return new PonyfillIteratorObject(this._keys(), 'HeadersIterator');
  }

  *_values(): IterableIterator<string> {
    if (this._setCookies?.length) {
      yield* this._setCookies;
    }
    if (!this._map) {
      if (this.headersInit) {
        if (Array.isArray(this.headersInit)) {
          yield* this.headersInit.map(([, value]) => value)[Symbol.iterator]();
          return;
        }
        if (isHeadersLike(this.headersInit)) {
          yield* this.headersInit.values();
          return;
        }
        yield* Object.values(this.headersInit)[Symbol.iterator]();
        return;
      }
    }
    yield* this.getMap().values();
  }

  values(): HeadersIterator<string> {
    return new PonyfillIteratorObject(this._values(), 'HeadersIterator');
  }

  *_entries(): IterableIterator<[string, string]> {
    if (this._setCookies?.length) {
      yield* this._setCookies.map(cookie => ['set-cookie', cookie] as [string, string]);
    }
    if (!this._map) {
      if (this.headersInit) {
        if (Array.isArray(this.headersInit)) {
          yield* this.headersInit;
          return;
        }
        if (isHeadersLike(this.headersInit)) {
          yield* this.headersInit.entries();
          return;
        }
        yield* Object.entries(this.headersInit);
        return;
      }
    }
    yield* this.getMap().entries();
  }

  entries(): HeadersIterator<[string, string]> {
    return new PonyfillIteratorObject(this._entries(), 'HeadersIterator');
  }

  getSetCookie() {
    if (!this._setCookies) {
      this.getMap();
    }
    return this._setCookies!;
  }

  [Symbol.iterator](): HeadersIterator<[string, string]> {
    return this.entries();
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    const record: Record<string, string[] | string> = {};
    this.forEach((value, key) => {
      if (key === 'set-cookie') {
        record['set-cookie'] = this._setCookies || [];
      } else {
        record[key] = value?.includes(',') ? value.split(',').map(el => el.trim()) : value;
      }
    });
    return `Headers ${inspect(record)}`;
  }
}
