import { describe, expect, it, jest } from '@jest/globals';
import { mapAsyncIterator } from '../src/index';

describe('mapAsyncIterator', () => {
  it('should invoke onNext callback, for each value, replace results and invoke onEnd only once regardless of how many times return was called', async () => {
    const onNext = jest.fn(() => 'replacer');
    const onEnd = jest.fn();
    const iter = mapAsyncIterator(
      (async function* () {
        yield 1;
        yield 2;
        yield 3;
      })(),
      onNext,
      () => {
        // noop onError
      },
      // @ts-expect-error - noop
      onEnd,
    );
    const onNextResults: string[] = [];
    for await (const result of iter) {
      onNextResults.push(result);
    }
    await Promise.all([iter.return?.(), iter.return?.(), iter.return?.()]);
    expect(onNext).toHaveBeenCalledTimes(3);
    expect(onNextResults).toEqual(['replacer', 'replacer', 'replacer']);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('should invoke onError only once regardless of how many times throw was called', async () => {
    const err = new Error('Woopsie!');
    const onNext = jest.fn();
    const onError = jest.fn();
    const iter = mapAsyncIterator(
      (async function* () {
        yield 1;
        yield 2;
        yield 3;
      })(),
      onNext,
      onError,
    );
    for await (const _ of iter) {
      // noop
    }
    await Promise.all([iter.throw?.(err), iter.throw?.(err), iter.throw?.(err)]);
    expect(onNext).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenCalledWith(err);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
