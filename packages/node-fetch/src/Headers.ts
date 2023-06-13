export type PonyfillHeadersInit =
  | [string, string][]
  | Record<string, string | string[] | undefined>
  | Headers;

export function isHeadersLike(headers: any): headers is Headers {
  return headers?.get && headers?.forEach;
}

export class PonyfillHeaders implements Headers {
  private map = new Map<string, string>();
  private mapIsBuilt = false;
  private objectNormalizedKeysOfHeadersInit: string[] = [];
  private objectOriginalKeysOfHeadersInit: string[] = [];
  private headersInit?: PonyfillHeadersInit;

  constructor(headersInit?: PonyfillHeadersInit) {
    if (isHeadersLike(headersInit)) {
      return headersInit as PonyfillHeaders;
    }
    this.headersInit = headersInit;
  }

  // perf: we don't need to build `this.map` for Requests, as we can access the headers directly
  private _get(key: string) {
    // If the map is built, reuse it
    if (this.mapIsBuilt) {
      return this.map.get(key.toLowerCase()) || null;
    }

    // If the map is not built, try to get the value from the this.headersInit
    if (this.headersInit == null) {
      return null;
    }

    const normalized = key.toLowerCase();
    if (Array.isArray(this.headersInit)) {
      return this.headersInit.find(header => header[0] === normalized);
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
    if (this.mapIsBuilt) {
      return this.map;
    }

    if (this.headersInit != null) {
      if (Array.isArray(this.headersInit)) {
        this.map = new Map(this.headersInit);
      } else if (isHeadersLike(this.headersInit)) {
        this.headersInit.forEach((value, key) => {
          this.map.set(key, value);
        });
      } else {
        for (const initKey in this.headersInit) {
          const initValue = this.headersInit[initKey];
          if (initValue != null) {
            const normalizedValue = Array.isArray(initValue) ? initValue.join(', ') : initValue;
            const normalizedKey = initKey.toLowerCase();
            this.map.set(normalizedKey, normalizedValue);
          }
        }
      }
    }

    this.mapIsBuilt = true;
    return this.map;
  }

  append(name: string, value: string): void {
    const key = name.toLowerCase();
    const existingValue = this.getMap().get(key);
    const finalValue = existingValue ? `${existingValue}, ${value}` : value;
    this.getMap().set(key, finalValue);
  }

  get(name: string): string | null {
    const key = name.toLowerCase();
    const value = this._get(key);

    if (value == null) {
      return null;
    }

    if (Array.isArray(value)) {
      return value.join(', ');
    }

    return value;
  }

  has(name: string): boolean {
    const key = name.toLowerCase();
    return !!this._get(key); // we might need to check if header exists and not just check if it's not nullable
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
    this.getMap().forEach((value, key) => {
      callback(value, key, this);
    });
  }

  keys(): IterableIterator<string> {
    return this.getMap().keys();
  }

  values(): IterableIterator<string> {
    return this.getMap().values();
  }

  entries(): IterableIterator<[string, string]> {
    return this.getMap().entries();
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.getMap().entries();
  }
}
