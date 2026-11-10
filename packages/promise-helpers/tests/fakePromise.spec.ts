import { expect, it, jest } from '@jest/globals';
import {
  fakePromise,
  fakeRejectPromise,
  handleMaybePromise,
} from '@whatwg-node/promise-helpers';

it('should not consider fakePromises as Promises', () => {
  const fake$ = fakePromise('value');
  const thenSpy = jest.fn(val => val);
  const returnVal = handleMaybePromise(() => fake$, thenSpy);
  expect(thenSpy).toHaveBeenCalledWith('value');
  expect(returnVal).toBe('value');
});

it('shares prototype methods across resolved fake promises', () => {
  const a = fakePromise(1);
  const b = fakePromise(2);
  expect(Object.getPrototypeOf(a)).toBe(Object.getPrototypeOf(b));
  expect(Object.prototype.toString.call(a)).toBe('[object Promise]');
  expect(Object.hasOwn(a, 'then')).toBe(false);
});

it('shares prototype methods across rejected fake promises', async () => {
  const a = fakeRejectPromise(new Error('a'));
  const b = fakeRejectPromise(new Error('b'));
  expect(Object.getPrototypeOf(a)).toBe(Object.getPrototypeOf(b));
  expect(Object.prototype.toString.call(a)).toBe('[object Promise]');
  // Bun's expect().rejects only accepts native Promise; adopt via Promise.resolve.
  await expect(Promise.resolve(a)).rejects.toThrow('a');
});
