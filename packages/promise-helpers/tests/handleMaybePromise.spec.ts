/* eslint-disable prefer-promise-reject-errors */
import { beforeEach } from 'node:test';
import { describe, expect, it, jest } from '@jest/globals';
import { handleMaybePromise } from '../src';

describe('promise-helpers', () => {
  describe('handleMaybePromise', () => {
    describe('finally', () => {
      const onFinally = jest.fn(() => Promise.resolve());
      const onError = jest.fn(err => Promise.resolve(err));
      const onSuccess = jest.fn(res => Promise.resolve(res));

      beforeEach(() => {
        jest.clearAllMocks();
      });

      it('should call finally and allow chaining with a successful Promise', async () => {
        expect(
          await handleMaybePromise(() => Promise.resolve('test'), onSuccess, onError, onFinally),
        ).toBe('test');
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onFinally).toHaveBeenCalledTimes(1);
        expect(onError).not.toHaveBeenCalled();
      });

      it('should call finally and allow chaining with a fake promise', async () => {
        expect(
          await handleMaybePromise(() => Promise.reject('error'), onSuccess, onError, onFinally),
        ).toBe('error');
        expect(onSuccess).not.toHaveBeenCalled();
        expect(onFinally).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
      });
    });
  });
});
