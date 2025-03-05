import { expect, it, jest } from '@jest/globals';
import { fakePromise, handleMaybePromise } from '@whatwg-node/promise-helpers';

it('should not consider fakePromises as Promises', () => {
  const fake$ = fakePromise('value');
  const thenSpy = jest.fn(val => val);
  const returnVal = handleMaybePromise(() => fake$, thenSpy);
  expect(thenSpy).toHaveBeenCalledWith('value');
  expect(returnVal).toBe('value');
});
