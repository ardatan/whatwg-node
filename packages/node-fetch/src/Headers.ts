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
      const mapped = this._map.get(normalized);
      return mapped === undefined ? null : mapped;
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
      this._setCookies ||= [];
      if (this.headersInit != null) {
        if (Array.isArray(this.headersInit)) {
          this._map = new Map();
          for (const [key, value] of this.headersInit) {
            const normalizedKey = key.toLowerCase();
            if (normalizedKey === 'set-cookie') {
              if (Array.isArray(value)) {
                this._setCookies.push(...value);
              } else if (value != null) {
                this._setCookies.push(value);
              }
              continue;
            }
            const existingValue = this._map.get(normalizedKey);
            this._map.set(
              normalizedKey,
              existingValue === undefined ? value : `${existingValue}, ${value}`,
            );
          }
        } else if (isHeadersLike(this.headersInit)) {
          this._map = new Map();
          this.headersInit.forEach((value, key) => {
            if (key === 'set-cookie') {
              this._setCookies ||= [];
              if (Array.isArray(value)) {
                this._setCookies.push(...value);
              } else if (value != null) {
                this._setCookies.push(value);
              }
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
                if (Array.isArray(initValue)) {
                  this._setCookies.push(...initValue);
                  continue;
                }
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

  // A sequence can repeat a name, so it is iterated through the map, which combines the values
  private buildMapForSequence() {
    if (!this._map && Array.isArray(this.headersInit)) {
      this.getMap();
    }
  }

  append(name: string, value: string): void {
    const key = name.toLowerCase();
    if (key === 'set-cookie') {
      // Materialize sequence cookies first so later getMap() does not re-append them.
      this.buildMapForSequence();
      this._setCookies ||= [];
      this._setCookies.push(value);
      return;
    }
    const existingValue = this.getMap().get(key);
    const finalValue = existingValue === undefined ? value : `${existingValue}, ${value}`;
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
    const key = name.toLowerCase();
    if (key === 'set-cookie') {
      return !!this._setCookies?.length;
    }
    return this._get(name) !== null;
  }

  set(name: string, value: string): void {
    const key = name.toLowerCase();
    if (key === 'set-cookie') {
      // Materialize sequence cookies first so later getMap() does not re-append them.
      this.buildMapForSequence();
      this._setCookies = [value];
      return;
    }
    // A sequence can repeat a name, so it goes through the map
    if (!this._map && this.headersInit != null && !Array.isArray(this.headersInit)) {
      if (isHeadersLike(this.headersInit)) {
        this.headersInit.set(key, value);
        return;
      } else {
        this.headersInit[key] = value;
        return;
      }
    }
    this.getMap().set(key, value);
  }

  delete(name: string): void {
    const key = name.toLowerCase();
    if (key === 'set-cookie') {
      // Materialize sequence cookies first so later getMap() does not re-append them.
      this.buildMapForSequence();
      this._setCookies = [];
      return;
    }
    this.getMap().delete(key);
  }

  // Fetch iterates the result of "sort and combine": names ascending by byte order.
  private *sortedEntries(): IterableIterator<[string, string]> {
    this.buildMapForSequence();

    if (!this._map) {
      if (this.headersInit) {
        if (isHeadersLike(this.headersInit)) {
          const names: string[] = [];
          const valuesByName = new Map<string, string[]>();
          this.headersInit.forEach((value, key) => {
            const name = key.toLowerCase();
            let values = valuesByName.get(name);
            if (!values) {
              values = [];
              valuesByName.set(name, values);
              names.push(name);
            }
            values.push(value);
          });
          names.sort();
          for (const name of names) {
            const values = valuesByName.get(name)!;
            if (name === 'set-cookie') {
              for (const value of values) {
                yield [name, value];
              }
            } else {
              yield [name, values.join(', ')];
            }
          }
          return;
        }

        const nameSet = new Set<string>();
        for (const key of Object.keys(this.headersInit)) {
          if (this.headersInit[key] != null) {
            nameSet.add(key.toLowerCase());
          }
        }
        const names = [...nameSet].sort();
        for (const name of names) {
          if (name === 'set-cookie') {
            const value = this._get(name);
            if (value != null) {
              yield ['set-cookie', value];
            }
            continue;
          }
          yield [name, this._get(name)!];
        }
        return;
      }
      // set-cookie may exist without a map (append/set on an empty Headers)
      if (this._setCookies?.length) {
        for (const cookie of this._setCookies) {
          yield ['set-cookie', cookie];
        }
      }
      return;
    }

    const names = [...this._map.keys()];
    if (this._setCookies?.length) {
      names.push('set-cookie');
    }
    names.sort();
    for (const name of names) {
      if (name === 'set-cookie') {
        for (const cookie of this._setCookies!) {
          yield ['set-cookie', cookie];
        }
        continue;
      }
      yield [name, this._map.get(name)!];
    }
  }

  forEach(callback: (value: string, key: string, parent: Headers) => void): void {
    for (const [key, value] of this.sortedEntries()) {
      callback(value, key, this);
    }
  }

  *_keys(): IterableIterator<string> {
    for (const [key] of this.sortedEntries()) {
      yield key;
    }
  }

  keys(): HeadersIterator<string> {
    return new PonyfillIteratorObject(this._keys(), 'HeadersIterator');
  }

  *_values(): IterableIterator<string> {
    for (const [, value] of this.sortedEntries()) {
      yield value;
    }
  }

  values(): HeadersIterator<string> {
    return new PonyfillIteratorObject(this._values(), 'HeadersIterator');
  }

  *_entries(): IterableIterator<[string, string]> {
    yield* this.sortedEntries();
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
