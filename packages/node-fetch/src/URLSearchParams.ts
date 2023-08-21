import FastQuerystring from 'fast-querystring';

function isURLSearchParams(value: any): value is URLSearchParams {
  return value?.entries != null;
}

export class PonyfillURLSearchParams implements URLSearchParams {
  private params: Record<string, string>;
  constructor(init?: string | string[][] | Record<string, string> | URLSearchParams) {
    if (init) {
      if (typeof init === 'string') {
        this.params = FastQuerystring.parse(init);
      } else if (Array.isArray(init)) {
        this.params = {};
        for (const [key, value] of init) {
          this.params[key] = value;
        }
      } else if (isURLSearchParams(init)) {
        this.params = {};
        for (const [key, value] of (init as URLSearchParams).entries()) {
          this.params[key] = value;
        }
      } else {
        this.params = init;
      }
    } else {
      this.params = {};
    }
  }

  append(name: string, value: string): void {
    const existingValue = this.params[name];
    const finalValue = existingValue ? `${existingValue},${value}` : value;
    this.params[name] = finalValue;
  }

  delete(name: string): void {
    delete this.params[name];
  }

  get(name: string): string | null {
    const value = this.params[name];
    if (Array.isArray(value)) {
      return value[0] || null;
    }
    return value || null;
  }

  getAll(name: string): string[] {
    const value = this.params[name];
    if (!Array.isArray(value)) {
      return value ? [value] : [];
    }
    return value;
  }

  has(name: string): boolean {
    return name in this.params;
  }

  set(name: string, value: string): void {
    this.params[name] = value;
  }

  sort(): void {
    const sortedKeys = Object.keys(this.params).sort();
    const sortedParams: Record<string, string> = {};
    for (const key of sortedKeys) {
      sortedParams[key] = this.params[key];
    }
    this.params = sortedParams;
  }

  toString(): string {
    return FastQuerystring.stringify(this.params);
  }

  *keys(): IterableIterator<string> {
    for (const key in this.params) {
      yield key;
    }
  }

  *entries(): IterableIterator<[string, string]> {
    for (const key of this.keys()) {
      const value = this.params[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          yield [key, item];
        }
      } else {
        yield [key, value];
      }
    }
  }

  *values(): IterableIterator<string> {
    for (const [, value] of this) {
      yield value;
    }
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
  }

  forEach(callback: (value: string, key: string, parent: URLSearchParams) => void): void {
    for (const [key, value] of this) {
      callback(value, key, this);
    }
  }

  get size(): number {
    return Object.keys(this.params).length;
  }
}
