/* eslint-disable prefer-promise-reject-errors, no-throw-literal */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fakePromise, fakeRejectPromise, handleMaybePromise } from '../src';

describe('promise-helpers', () => {
  describe('handleMaybePromise', () => {
    describe('should be sync', () => {
      const cases = [
        { input: 'sync', output: 'sync' },
        { input: 'fake', output: 'sync' },
        { input: 'sync', output: 'fake' },
        { input: 'fake', output: 'fake' },
      ];

      it.each(cases)('when input is $input and success is $output', ({ input, output }) => {
        expect(
          handleMaybePromise(
            () => (input === 'fake' ? fakePromise('test') : 'test'),
            res => (output === 'fake' ? fakePromise(res) : res),
          ),
        ).toBe('test');
      });

      it.each(cases)('when input is $input and onError is $output', ({ input, output }) => {
        expect(
          handleMaybePromise(
            () => {
              if (input === 'fake') {
                return fakeRejectPromise('error');
              } else {
                throw 'error';
              }
            },
            res => res,
            () => (output === 'fake' ? fakePromise('test') : 'test'),
          ),
        ).toBe('test');
      });

      it.each(
        cases.flatMap(c => [
          { ...c, success: 'fake' },
          { ...c, success: 'sync' },
        ]),
      )(
        'when input is $input, onSuccess is $success and onError is $output',
        ({ input, output, success }) => {
          try {
            handleMaybePromise(
              () => (input === 'fake' ? fakePromise('test') : 'test'),
              () => {
                if (success === 'fake') {
                  return fakeRejectPromise('error');
                } else {
                  throw 'error';
                }
              },
              () => (output === 'fake' ? fakePromise('test') : 'test'),
            );
            throw new Error('error has not been thrown');
          } catch (err) {
            expect(err).toBe('error');
          }
        },
      );

      it.each(cases)(
        'when fake value is falsy; input: $input output: $output',
        ({ input, output }) => {
          expect(
            handleMaybePromise(
              () => (input === 'fake' ? fakePromise(undefined) : undefined),
              res => (output === 'fake' ? fakePromise(undefined) : res),
            ),
          ).toBe(undefined);

          expect(
            handleMaybePromise(
              () => (input === 'fake' ? fakePromise(null) : null),
              res => (output === 'fake' ? fakePromise(null) : res),
            ),
          ).toBe(null);

          expect(
            handleMaybePromise(
              () => (input === 'fake' ? fakePromise('') : ''),
              res => (output === 'fake' ? fakePromise('') : res),
            ),
          ).toBe('');

          expect(
            handleMaybePromise(
              () => (input === 'fake' ? fakePromise(false) : false),
              res => (output === 'fake' ? fakePromise(false) : res),
            ),
          ).toBe(false);

          expect(
            handleMaybePromise(
              () => (input === 'fake' ? fakePromise(0) : 0),
              res => (output === 'fake' ? fakePromise(0) : res),
            ),
          ).toBe(0);
        },
      );
    });
    describe('finally', () => {
      describe('with promises', () => {
        let onFinally: jest.MockedFunction<any>;
        let onError: jest.MockedFunction<any>;
        let onSuccess: jest.MockedFunction<any>;

        beforeEach(() => {
          onFinally = jest.fn(() => Promise.resolve());
          onError = jest.fn(err => Promise.resolve(err));
          onSuccess = jest.fn(res => Promise.resolve(res));
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
          onSuccess = jest.fn(() => Promise.reject('error'));
          await expect(
            handleMaybePromise(() => Promise.resolve('test'), onSuccess, onError, onFinally),
          ).rejects.toBe('error');
          expect(onFinally).toHaveReturnedTimes(1);
          expect(onSuccess).toHaveBeenCalledTimes(1);
          expect(onError).not.toHaveBeenCalled();
        });

        it('should call finally even if onError is rejected', async () => {
          onError = jest.fn(() => Promise.reject('error'));
          await expect(
            handleMaybePromise(() => Promise.reject('test'), onSuccess, onError, onFinally),
          ).rejects.toBe('error');
          expect(onFinally).toHaveReturnedTimes(1);
          expect(onError).toHaveBeenCalledTimes(1);
          expect(onSuccess).not.toHaveBeenCalled();
        });
      });

      describe('with sync function', () => {
        let onFinally: jest.Mock<() => void>;
        let onError: jest.Mock;
        let onSuccess: jest.Mock;

        beforeEach(() => {
          onFinally = jest.fn(() => {});
          onError = jest.fn(err => err);
          onSuccess = jest.fn(res => res);
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
            throw 'Error was not thrown';
          } catch (err) {
            expect(err).toBe('error');
          }
          expect(onFinally).toHaveBeenCalledTimes(1);
          expect(onSuccess).not.toHaveBeenCalled();
        });

        it('should call finally even if onSuccess throws', async () => {
          onSuccess = jest.fn(() => {
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
          onError = jest.fn(() => {
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
        let onFinally: jest.Mock<() => void>;
        let onError: jest.Mock;
        let onSuccess: jest.Mock;

        beforeEach(() => {
          onFinally = jest.fn(() => {});
          onSuccess = jest.fn(res => fakePromise(res));
          onError = jest.fn(err => fakePromise(err));
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
            throw 'Error has not been thrown';
          } catch (err) {
            expect(err).toBe('error');
          }
          expect(onFinally).toHaveBeenCalledTimes(1);
          expect(onSuccess).not.toHaveBeenCalled();
        });

        it('should call finally even if onSuccess throws', async () => {
          onSuccess = jest.fn(() => fakeRejectPromise('error'));
          await expect(
            handleMaybePromise(() => Promise.resolve('test'), onSuccess, onError, onFinally),
          ).rejects.toBe('error');
          expect(onFinally).toHaveReturnedTimes(1);
          expect(onSuccess).toHaveBeenCalledTimes(1);
          expect(onError).not.toHaveBeenCalled();
        });

        it('should call finally even if onError throws', async () => {
          onError = jest.fn(() => fakeRejectPromise('error'));
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
