import { describe, expect, it } from '@jest/globals';
import { isPromise } from '../src/index';

describe('isPromise', () => {
  it('should consider an actual promise as a promise', () => {
    const promise = new Promise(() => {});
    expect(isPromise(promise)).toBeTruthy();
  });

  it('should not consider an object with a property "then" that is not a function as a promise', () => {
    const obj = {
      foo: 'bar',
      then: 'baz',
    };

    expect(isPromise(obj)).toBeFalsy();
  });
});
