export type PonyfillHeadersInit = [string, string][] | Record<string, string> | Headers;

export function isHeadersLike(headers: any): headers is Headers {
  return headers?.get && headers?.forEach;
}

export class PonyfillHeaders implements Headers {
  private _map: Map<string, string> | undefined;
  private objectNormalizedKeysOfHeadersInit: string[] = [];
  private objectOriginalKeysOfHeadersInit: string[] = [];

  constructor(private headersInit?: PonyfillHeadersInit) {}

  // perf: we don't need to build `this.map` for Requests, as we can access the headers directly
  private _get(key: string) {
    // If the map is built, reuse it
    if (this._map) {
      return this._map.get(key.toLowerCase()) || null;
    }

    // If the map is not built, try to get the value from the this.headersInit
    if (this.headersInit == null) {
      return null;
    }

    const normalized = key.toLowerCase();
    if (Array.isArray(this.headersInit)) {
      return this.headersInit.find(header => header[0] === normalized)?.[1] || null;
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
      if (this.headersInit != null) {
        if (Array.isArray(this.headersInit)) {
          this._map = new Map(this.headersInit);
        } else if (isHeadersLike(this.headersInit)) {
          this._map = new Map();
          this.headersInit.forEach((value, key) => {
            this._map!.set(key, value);
          });
        } else {
          this._map = new Map();
          for (const initKey in this.headersInit) {
            const initValue = this.headersInit[initKey];
            if (initValue != null) {
              const normalizedKey = initKey.toLowerCase();
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
    const existingValue = this.getMap().get(key);
    const finalValue = existingValue ? `${existingValue}, ${value}` : value;
    this.getMap().set(key, finalValue);
  }

  get(name: string): string | null {
    const value = this._get(name);

    if (value == null) {
      return null;
    }

    return value;
  }

  has(name: string): boolean {
    return !!this._get(name); // we might need to check if header exists and not just check if it's not nullable
  }

  set(name: string, value: string): void {
    const key = name.toLowerCase();
    this.getMap().set(key, value);
  }

  delete(name: string): void {
    const key = name.toLowerCase();
    this.getMap().delete(key);
  }

  forEach(callback: (value: string, key: string, parent: Headers) => void): void {
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

  keys(): IterableIterator<string> {
    if (!this._map) {
      if (this.headersInit) {
        if (Array.isArray(this.headersInit)) {
          return this.headersInit.map(([key]) => key)[Symbol.iterator]();
        }
        if (isHeadersLike(this.headersInit)) {
          return this.headersInit.keys();
        }
        return Object.keys(this.headersInit)[Symbol.iterator]();
      }
    }
    return this.getMap().keys();
  }

  values(): IterableIterator<string> {
    if (!this._map) {
      if (this.headersInit) {
        if (Array.isArray(this.headersInit)) {
          return this.headersInit.map(([, value]) => value)[Symbol.iterator]();
        }
        if (isHeadersLike(this.headersInit)) {
          return this.headersInit.values();
        }
        return Object.values(this.headersInit)[Symbol.iterator]();
      }
    }
    return this.getMap().values();
  }

  entries(): IterableIterator<[string, string]> {
    if (!this._map) {
      if (this.headersInit) {
        if (Array.isArray(this.headersInit)) {
          return this.headersInit[Symbol.iterator]();
        }
        if (isHeadersLike(this.headersInit)) {
          return this.headersInit.entries();
        }
        return Object.entries(this.headersInit)[Symbol.iterator]();
      }
    }
    return this.getMap().entries();
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
  }
}
