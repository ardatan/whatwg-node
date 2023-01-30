export type PonyfillHeadersInit = [string, string][] | Record<string, string | string[] | undefined> | Headers;

export class PonyfillHeaders implements Headers {
  private map = new Map<string, string>();
  constructor(headersInit?: PonyfillHeadersInit) {
    if (headersInit != null) {
      if (Array.isArray(headersInit)) {
        for (const [key, value] of headersInit) {
          if (Array.isArray(value)) {
            for (const v of value) {
              this.append(key, v);
            }
          } else {
            this.map.set(key, value);
          }
        }
      } else if ('get' in headersInit) {
        (headersInit as Headers).forEach((value, key) => {
          this.append(key, value);
        });
      } else {
        for (const key in headersInit) {
          const value = headersInit[key];
          if (Array.isArray(value)) {
            for (const v of value) {
              this.append(key, v);
            }
          } else if (value != null) {
            this.set(key, value);
          }
        }
      }
    }
  }

  append(name: string, value: string): void {
    const key = name.toLowerCase();
    if (this.map.has(key)) {
      value = this.map.get(key) + ', ' + value;
    }
    this.map.set(key, value);
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
