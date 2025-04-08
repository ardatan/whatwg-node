export type MaybePromise<T> = Promise<T> | T;
export type MaybePromiseLike<T> = PromiseLike<T> | T;

const FAKE_PROMISE_SYMBOL_NAME = '@whatwg-node/promise-helpers/FakePromise';

export function isPromise<T>(value: MaybePromise<T>): value is Promise<T>;
export function isPromise<T>(value: MaybePromiseLike<T>): value is PromiseLike<T>;
export function isPromise<T>(value: MaybePromiseLike<T>): value is PromiseLike<T> {
  return (value as any)?.then != null;
}

export function isActualPromise<T>(value: MaybePromiseLike<T>): value is Promise<T> {
  const maybePromise = value as any;
  return maybePromise && maybePromise.then && maybePromise.catch && maybePromise.finally;
}

export function handleMaybePromise<TInput, TOutput>(
  inputFactory: () => MaybePromise<TInput>,
  outputSuccessFactory: (value: TInput) => MaybePromise<TOutput>,
  outputErrorFactory?: (err: any) => MaybePromise<TOutput>,
  finallyFactory?: () => MaybePromise<void>,
): MaybePromise<TOutput>;
export function handleMaybePromise<TInput, TOutput>(
  inputFactory: () => MaybePromiseLike<TInput>,
  outputSuccessFactory: (value: TInput) => MaybePromiseLike<TOutput>,
  outputErrorFactory?: (err: any) => MaybePromiseLike<TOutput>,
  finallyFactory?: () => MaybePromiseLike<void>,
): MaybePromiseLike<TOutput>;
export function handleMaybePromise<TInput, TOutput>(
  inputFactory: () => MaybePromiseLike<TInput>,
  outputSuccessFactory: (value: TInput) => MaybePromiseLike<TOutput>,
  outputErrorFactory?: (err: any) => MaybePromiseLike<TOutput>,
  finallyFactory?: () => MaybePromiseLike<void>,
): MaybePromiseLike<TOutput> {
  let result$ = fakePromise().then(inputFactory).then(outputSuccessFactory, outputErrorFactory);

  if (finallyFactory) {
    result$ = result$.finally(finallyFactory);
  }

  return unfakePromise(result$);
}

export function fakePromise<T>(value: MaybePromise<T>): Promise<T>;
export function fakePromise<T>(value: MaybePromiseLike<T>): Promise<T>;
export function fakePromise(value: void): Promise<void>;
export function fakePromise<T>(value: MaybePromiseLike<T>): Promise<T> {
  if (value && isActualPromise(value)) {
    return value;
  }

  if (isPromise(value)) {
    return {
      then: (resolve, reject) => fakePromise(value.then(resolve, reject)),
      catch: reject => fakePromise(value.then(res => res, reject)),
      finally: cb => fakePromise(cb ? promiseLikeFinally(value, cb) : value),
      [Symbol.toStringTag]: 'Promise',
    };
  }

  // Write a fake promise to avoid the promise constructor
  // being called with `new Promise` in the browser.
  return {
    then(resolve) {
      if (resolve) {
        try {
          return fakePromise(resolve(value));
        } catch (err) {
          return fakeRejectPromise(err);
        }
      }
      return this;
    },
    catch() {
      return this;
    },
    finally(cb) {
      if (cb) {
        try {
          return fakePromise(cb()).then(
            () => value,
            () => value,
          );
        } catch (err) {
          return fakeRejectPromise(err);
        }
      }
      return this;
    },
    [Symbol.toStringTag]: 'Promise',
    __fakePromiseValue: value,
    [Symbol.for(FAKE_PROMISE_SYMBOL_NAME)]: 'resolved',
  } as Promise<T>;
}

export interface DeferredPromise<T = void> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: any) => void;
}

export function createDeferredPromise<T = void>(): DeferredPromise<T> {
  if (Promise.withResolvers) {
    return Promise.withResolvers<T>();
  }
  let resolveFn: (value: T) => void;
  let rejectFn: (reason: any) => void;
  const promise = new Promise<T>(function deferredPromiseExecutor(resolve, reject) {
    resolveFn = resolve;
    rejectFn = reject;
  });
  return {
    promise,
    get resolve() {
      return resolveFn;
    },
    get reject() {
      return rejectFn;
    },
  };
}

export { iterateAsync as iterateAsyncVoid };

export function iterateAsync<TInput, TOutput>(
  iterable: Iterable<TInput>,
  callback: (
    input: TInput,
    endEarly: () => void,
    index: number,
  ) => MaybePromise<TOutput | undefined | null | void>,
  results?: TOutput[],
): MaybePromise<void> {
  if ((iterable as Array<TInput>)?.length === 0) {
    return;
  }
  const iterator = iterable[Symbol.iterator]();
  let index = 0;
  function iterate(): MaybePromise<void> {
    const { done: endOfIterator, value } = iterator.next();
    if (endOfIterator) {
      return;
    }
    let endedEarly = false;
    function endEarly() {
      endedEarly = true;
    }
    return handleMaybePromise(
      function handleCallback() {
        return callback(value, endEarly, index++);
      },
      function handleCallbackResult(result) {
        if (result) {
          results?.push(result);
        }
        if (endedEarly) {
          return;
        }
        return iterate();
      },
    );
  }
  return iterate();
}

export function fakeRejectPromise<T>(error: unknown): Promise<T> {
  return {
    then(_resolve, reject) {
      if (reject) {
        try {
          return fakePromise(reject(error));
        } catch (err) {
          return fakeRejectPromise(err);
        }
      }
      return this;
    },
    catch(reject: (error: unknown) => any) {
      if (reject) {
        try {
          return fakePromise(reject(error));
        } catch (err) {
          return fakeRejectPromise(err);
        }
      }
      return this;
    },
    finally(cb) {
      if (cb) {
        try {
          cb();
        } catch (err) {
          return fakeRejectPromise(err);
        }
      }
      return this;
    },
    __fakeRejectError: error,
    [Symbol.toStringTag]: 'Promise',
    [Symbol.for(FAKE_PROMISE_SYMBOL_NAME)]: 'rejected',
  } as Promise<never>;
}

/**
 * @deprecated Use `handleMaybePromise` instead.
 */
export function mapMaybePromise<TInput, TOutput>(
  input: MaybePromise<TInput>,
  onSuccess: (value: TInput) => MaybePromise<TOutput>,
  onError?: (err: any) => MaybePromise<TOutput>,
): MaybePromise<TOutput>;
export function mapMaybePromise<TInput, TOutput>(
  input: MaybePromiseLike<TInput>,
  onSuccess: (value: TInput) => MaybePromiseLike<TOutput>,
  onError?: (err: any) => MaybePromiseLike<TOutput>,
): MaybePromiseLike<TOutput>;
export function mapMaybePromise<TInput, TOutput>(
  input: MaybePromiseLike<TInput>,
  onSuccess: (value: TInput) => MaybePromiseLike<TOutput>,
  onError?: (err: any) => MaybePromiseLike<TOutput>,
): MaybePromiseLike<TOutput> {
  return handleMaybePromise(() => input, onSuccess, onError);
}

/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 */
export function mapAsyncIterator<T, U>(
  iterator: AsyncIterable<T> | AsyncIterator<T>,
  onNext: (value: T) => MaybePromise<U>,
  onError?: any,
  onEnd?: () => MaybePromise<void>,
): AsyncIterableIterator<U> {
  if (Symbol.asyncIterator in iterator) {
    iterator = iterator[Symbol.asyncIterator]();
  }
  let $return: () => Promise<IteratorResult<T>>;
  let abruptClose: (error: any) => Promise<never>;
  let onEndWithValue: <R>(value: R) => MaybePromise<R>;

  if (onEnd) {
    let onEndWithValueResult: any /** R in onEndWithValue */;
    onEndWithValue = value => {
      onEndWithValueResult ||= handleMaybePromise(
        onEnd,
        () => value,
        () => value,
      );
      return onEndWithValueResult;
    };
  }

  if (typeof iterator.return === 'function') {
    $return = iterator.return;
    abruptClose = (error: any) => {
      const rethrow = () => {
        throw error;
      };
      return $return.call(iterator).then(rethrow, rethrow);
    };
  }

  function mapResult(result: any) {
    if (result.done) {
      return onEndWithValue ? onEndWithValue(result) : result;
    }
    return handleMaybePromise(
      () => result.value,
      value => handleMaybePromise(() => onNext(value), iteratorResult, abruptClose),
    );
  }

  let mapReject: any;
  if (onError) {
    let onErrorResult: unknown;
    // Capture rejectCallback to ensure it cannot be null.
    const reject = onError;
    mapReject = (error: any) => {
      onErrorResult ||= handleMaybePromise(
        () => error,
        error => handleMaybePromise(() => reject(error), iteratorResult, abruptClose),
      );
      return onErrorResult;
    };
  }

  return {
    next() {
      return iterator.next().then(mapResult, mapReject);
    },
    return() {
      const res$ = $return
        ? $return.call(iterator).then(mapResult, mapReject)
        : fakePromise({ value: undefined, done: true });
      return onEndWithValue ? res$.then(onEndWithValue) : res$;
    },
    throw(error: any) {
      if (typeof iterator.throw === 'function') {
        return iterator.throw(error).then(mapResult, mapReject);
      }
      if (abruptClose) {
        return abruptClose(error);
      }
      return fakeRejectPromise(error);
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

function iteratorResult<T>(value: T): IteratorResult<T> {
  return { value, done: false };
}

function isFakePromise<T>(value: any): value is Promise<T> & { __fakePromiseValue: T } {
  return (value as any)?.[Symbol.for(FAKE_PROMISE_SYMBOL_NAME)] === 'resolved';
}

function isFakeRejectPromise(value: any): value is Promise<never> & { __fakeRejectError: any } {
  return (value as any)?.[Symbol.for(FAKE_PROMISE_SYMBOL_NAME)] === 'rejected';
}

export function promiseLikeFinally<T>(
  value: PromiseLike<T> | Promise<T>,
  onFinally: () => MaybePromiseLike<void>,
): PromiseLike<T> {
  if ('finally' in value) {
    return value.finally(onFinally);
  }

  return value.then(
    res => {
      const finallyRes = onFinally();
      return isPromise(finallyRes) ? finallyRes.then(() => res) : res;
    },
    err => {
      const finallyRes = onFinally();
      if (isPromise(finallyRes)) {
        return finallyRes.then(() => {
          throw err;
        });
      } else {
        throw err;
      }
    },
  );
}

export function unfakePromise<T>(promise: Promise<T>): MaybePromise<T> {
  if (isFakePromise<T>(promise)) {
    return promise.__fakePromiseValue;
  }

  if (isFakeRejectPromise(promise)) {
    throw promise.__fakeRejectError;
  }

  return promise;
}
