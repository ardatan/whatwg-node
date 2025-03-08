/* eslint-disable prefer-promise-reject-errors, no-throw-literal */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fakePromise, fakeRejectPromise, handleMaybePromise } from '../src';

describe('promise-helpers', () => {
  describe('handleMaybePromise', () => {
    describe('finally', () => {
      describe('with promises', () => {
        const onFinally = jest.fn(() => Promise.resolve());
        const onError = jest.fn(err => Promise.resolve(err));
        const onSuccess = jest.fn(res => Promise.resolve(res));

        beforeEach(() => {
          onFinally.mockClear();
          onSuccess.mockClear();
          onError.mockClear();
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
          expect(onError).toHaveBeenCalledTimes(1);
          expect(onFinally).toHaveBeenCalledTimes(1);
          expect(onSuccess).not.toHaveBeenCalled();
        });

        it('should call finally and allow reject if no error handler is given', async () => {
          await expect(
            handleMaybePromise(() => Promise.reject('error'), onSuccess, undefined, onFinally),
          ).rejects.toBe('error');
          expect(onFinally).toHaveBeenCalledTimes(1);
          expect(onSuccess).not.toHaveBeenCalled();
        });

        it('should call finally even if onSuccess is rejected', async () => {
          onSuccess.mockRejectedValueOnce('error');
          await expect(
            handleMaybePromise(() => Promise.resolve('test'), onSuccess, onError, onFinally),
          ).rejects.toBe('error');
          expect(onFinally).toHaveReturnedTimes(1);
          expect(onSuccess).toHaveBeenCalledTimes(1);
          expect(onError).not.toHaveBeenCalled();
        });

        it('should call finally even if onError is rejected', async () => {
          onError.mockRejectedValueOnce('error');
          await expect(
            handleMaybePromise(() => Promise.reject('test'), onSuccess, onError, onFinally),
          ).rejects.toBe('error');
          expect(onFinally).toHaveReturnedTimes(1);
          expect(onError).toHaveBeenCalledTimes(1);
          expect(onSuccess).not.toHaveBeenCalled();
        });
      });

      describe('with sync function', () => {
        const onFinally = jest.fn(() => {});
        const onError = jest.fn(err => err);
        const onSuccess = jest.fn(res => res);

        beforeEach(() => {
          onFinally.mockClear();
          onSuccess.mockClear();
          onError.mockClear();
        });

        it('should call finally and allow chaining with a successful function', () => {
          expect(handleMaybePromise(() => 'test', onSuccess, onError, onFinally)).toBe('test');
          expect(onFinally).toHaveBeenCalledTimes(1);
          expect(onSuccess).toHaveBeenCalledTimes(1);
          expect(onError).not.toHaveBeenCalled();
        });

        it('should call finally and allow chaining with a throwing function', () => {
          const throwingFn = () => {
            throw 'error';
          };
          expect(handleMaybePromise(throwingFn, onSuccess, onError, onFinally)).toBe('error');
          expect(onFinally).toHaveBeenCalledTimes(1);
          expect(onError).toHaveBeenCalledTimes(1);
          expect(onSuccess).not.toHaveBeenCalled();
        });

        it('should call finally and allow throw if no error handler is given', async () => {
          const throwingFn = () => {
            throw 'error';
          };
          try {
            handleMaybePromise(throwingFn, onSuccess, undefined, onFinally);
          } catch (err) {
            expect(err).toBe('error');
          }
          expect(onFinally).toHaveBeenCalledTimes(1);
          expect(onSuccess).not.toHaveBeenCalled();
          expect.assertions(3);
        });

        it('should call finally even if onSuccess throws', async () => {
          onSuccess.mockImplementationOnce(() => {
            throw 'error';
          });
          await expect(
            handleMaybePromise(() => Promise.resolve('test'), onSuccess, onError, onFinally),
          ).rejects.toBe('error');
          expect(onFinally).toHaveReturnedTimes(1);
          expect(onSuccess).toHaveBeenCalledTimes(1);
          expect(onError).not.toHaveBeenCalled();
        });

        it('should call finally even if onError throws', async () => {
          onError.mockImplementationOnce(() => {
            throw 'error';
          });
          await expect(
            handleMaybePromise(() => Promise.reject('test'), onSuccess, onError, onFinally),
          ).rejects.toBe('error');
          expect(onFinally).toHaveReturnedTimes(1);
          expect(onError).toHaveBeenCalledTimes(1);
          expect(onSuccess).not.toHaveBeenCalled();
        });
      });

      describe('with fake promises', () => {
        const onFinally = jest.fn(() => {});
        const onError = jest.fn(err => fakePromise(err));
        const onSuccess = jest.fn(res => fakePromise(res));

        beforeEach(() => {
          onFinally.mockClear();
          onSuccess.mockClear();
          onError.mockClear();
        });

        it('should call finally and allow chaining on successful fake promise', () => {
          expect(handleMaybePromise(() => fakePromise('test'), onSuccess, onError, onFinally)).toBe(
            'test',
          );
          expect(onSuccess).toHaveBeenCalledTimes(1);
          expect(onFinally).toHaveBeenCalledTimes(1);
          expect(onError).not.toHaveBeenCalled();
        });

        it('should call finally and allow chaining on rejected fake promise', () => {
          expect(
            handleMaybePromise(() => fakeRejectPromise('error'), onSuccess, onError, onFinally),
          ).toBe('error');
          expect(onError).toHaveBeenCalledTimes(1);
          expect(onFinally).toHaveBeenCalledTimes(1);
          expect(onSuccess).not.toHaveBeenCalled();
        });

        it('should call finally and allow throw if no error handler is given', async () => {
          try {
            handleMaybePromise(() => fakeRejectPromise('error'), onSuccess, undefined, onFinally);
          } catch (err) {
            expect(err).toBe('error');
          }
          expect(onFinally).toHaveBeenCalledTimes(1);
          expect(onSuccess).not.toHaveBeenCalled();
          expect.assertions(3);
        });

        it('should call finally even if onSuccess throws', async () => {
          onSuccess.mockReturnValueOnce(fakeRejectPromise('error'));
          await expect(
            handleMaybePromise(() => Promise.resolve('test'), onSuccess, onError, onFinally),
          ).rejects.toBe('error');
          expect(onFinally).toHaveReturnedTimes(1);
          expect(onSuccess).toHaveBeenCalledTimes(1);
          expect(onError).not.toHaveBeenCalled();
        });

        it('should call finally even if onError throws', async () => {
          onError.mockReturnValueOnce(fakeRejectPromise('error'));
          await expect(
            handleMaybePromise(() => Promise.reject('test'), onSuccess, onError, onFinally),
          ).rejects.toBe('error');
          expect(onFinally).toHaveReturnedTimes(1);
          expect(onError).toHaveBeenCalledTimes(1);
          expect(onSuccess).not.toHaveBeenCalled();
        });
      });
    });
  });
});
