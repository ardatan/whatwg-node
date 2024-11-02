import { isIterable } from './utils.js';

export class PonyfillIteratorObject<T> implements IteratorObject<T, undefined, unknown> {
  constructor(private iterableIterator: IterableIterator<T>) {}
  *map<U>(callbackfn: (value: T, index: number) => U) {
    let index = 0;
    for (const value of this.iterableIterator) {
      yield callbackfn(value, index++);
    }
    return undefined;
  }

  *filter(callbackfn: (value: T, index: number) => boolean) {
    let index = 0;
    for (const value of this.iterableIterator) {
      if (callbackfn(value, index++)) {
        yield value;
      }
    }
    return undefined;
  }

  reduce<U>(
    callbackfn: (previousValue: U, currentValue: T, currentIndex: number) => U,
    initialValue?: U,
  ) {
    let index = 0;
    let accumulator = initialValue as U;
    for (const value of this.iterableIterator) {
      accumulator = callbackfn(accumulator, value, index++);
    }
    return accumulator;
  }

  forEach(callbackfn: (value: T, index: number) => void): void {
    let index = 0;
    for (const value of this.iterableIterator) {
      callbackfn(value, index++);
    }
  }

  *take(limit: number) {
    let index = 0;
    for (const value of this.iterableIterator) {
      if (index >= limit) {
        break;
      }
      yield value;
      index++;
    }
    return undefined;
  }

  *drop(count: number): IteratorObject<T, undefined, unknown> {
    let index = 0;
    for (const value of this.iterableIterator) {
      if (index >= count) {
        yield value;
      }
      index++;
    }
    return undefined;
  }

  *flatMap<U>(
    callback: (
      value: T,
      index: number,
    ) => Iterator<U, unknown, undefined> | Iterable<U, unknown, undefined>,
  ): IteratorObject<U, undefined, unknown> {
    let index = 0;
    for (const value of this.iterableIterator) {
      const iteratorOrIterable = callback(value, index++);
      if (isIterable(iteratorOrIterable)) {
        for (const innerValue of iteratorOrIterable) {
          yield innerValue;
        }
      } else {
        for (const innerValue of {
          [Symbol.iterator]: () => iteratorOrIterable,
        }) {
          yield innerValue;
        }
      }
    }
    return undefined;
  }

  some(predicate: (value: T, index: number) => unknown): boolean {
    let index = 0;
    for (const value of this.iterableIterator) {
      if (predicate(value, index++)) {
        return true;
      }
    }
    return false;
  }

  every(predicate: (value: T, index: number) => unknown): boolean {
    let index = 0;
    for (const value of this.iterableIterator) {
      if (!predicate(value, index++)) {
        return false;
      }
    }
    return true;
  }

  find(predicate: (value: T, index: number) => unknown): T | undefined {
    let index = 0;
    for (const value of this.iterableIterator) {
      if (predicate(value, index++)) {
        return value;
      }
    }
    return undefined;
  }

  toArray(): T[] {
    return Array.from(this.iterableIterator);
  }

  [Symbol.dispose](): void {
    if (typeof (this.iterableIterator as any).return === 'function') {
      (this.iterableIterator as any).return();
    }
  }

  [Symbol.toStringTag] = 'URLSearchParamsIterator';
  next(...[value]: [] | [unknown]): IteratorResult<T, undefined> {
    return this.iterableIterator.next(value);
  }

  [Symbol.iterator](): URLSearchParamsIterator<T> {
    return this;
  }
}
