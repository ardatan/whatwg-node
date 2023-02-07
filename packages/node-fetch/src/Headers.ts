export type PonyfillHeadersInit =
  | [string, string][]
  | Record<string, string | string[] | undefined>
  | Headers;

function isHeadersLike(headers: any): headers is Headers {
  return headers && typeof headers.get === 'function';
}

export class PonyfillHeaders implements Headers {
  private map = new Map<string, string>();
  constructor(headersInit?: PonyfillHeadersInit) {
    if (headersInit != null) {
      if (Array.isArray(headersInit)) {
        this.map = new Map(headersInit);
      } else if (isHeadersLike(headersInit)) {
        headersInit.forEach((value, key) => {
          this.map.set(key, value);
        });
      } else {
        for (const key in headersInit) {
          const value = headersInit[key];
          if (value != null) {
            const normalizedValue = Array.isArray(value) ? value.join(', ') : value;
            this.map.set(key, normalizedValue);
          }
        }
      }
    }
  }

  append(name: string, value: string): void {
    const key = name.toLowerCase();
    const existingValue = this.map.get(key);
    const finalValue = existingValue ? `${existingValue}, ${value}` : value;
    this.map.set(key, finalValue);
  }

  get(name: string): string | null {
    const key = name.toLowerCase();
    return this.map.get(key) || null;
  }

  has(name: string): boolean {
    const key = name.toLowerCase();
    return this.map.has(key);
  }

  set(name: string, value: string): void {
    const key = name.toLowerCase();
    this.map.set(key, value);
  }

  delete(name: string): void {
    const key = name.toLowerCase();
    this.map.delete(key);
  }

  forEach(callback: (value: string, key: string, parent: Headers) => void): void {
    this.map.forEach((value, key) => {
      callback(value, key, this);
    });
  }

  entries(): IterableIterator<[string, string]> {
    return this.map.entries();
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.map.entries();
  }
}
