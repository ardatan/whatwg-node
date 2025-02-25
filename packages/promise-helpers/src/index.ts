export type MaybePromise<T> = Promise<T> | T;
export type MaybePromiseLike<T> = PromiseLike<T> | T;

export function isPromise<T>(value: MaybePromise<T>): value is Promise<T>;
export function isPromise<T>(value: MaybePromiseLike<T>): value is PromiseLike<T>;
export function isPromise<T>(value: MaybePromiseLike<T>): value is PromiseLike<T> {
  return (value as any)?.then != null;
}

export function handleMaybePromise<TInput, TOutput>(
  inputFactory: () => MaybePromise<TInput>,
  outputSuccessFactory: (value: TInput) => MaybePromise<TOutput>,
  outputErrorFactory?: (err: any) => MaybePromise<TOutput>,
): MaybePromise<TOutput>;
export function handleMaybePromise<TInput, TOutput>(
  inputFactory: () => MaybePromiseLike<TInput>,
  outputSuccessFactory: (value: TInput) => MaybePromiseLike<TOutput>,
  outputErrorFactory?: (err: any) => MaybePromiseLike<TOutput>,
): MaybePromiseLike<TOutput>;
export function handleMaybePromise<TInput, TOutput>(
  inputFactory: () => MaybePromiseLike<TInput>,
  outputSuccessFactory: (value: TInput) => MaybePromiseLike<TOutput>,
  outputErrorFactory?: (err: any) => MaybePromiseLike<TOutput>,
): MaybePromiseLike<TOutput> {
  function _handleMaybePromise() {
    const input$ = inputFactory() as MaybePromise<TInput>;
    if (isPromise(input$)) {
      return input$.then(outputSuccessFactory, outputErrorFactory);
    }
    return outputSuccessFactory(input$);
  }
  if (!outputErrorFactory) {
    return _handleMaybePromise();
  }
  try {
    return _handleMaybePromise();
  } catch (err) {
    return outputErrorFactory(err);
  }
}

export function fakePromise<T>(value: T): Promise<T>;
export function fakePromise(value: void): Promise<void>;
export function fakePromise<T = void>(value: T): Promise<T> {
  if (isPromise(value)) {
    return value;
  }
  // Write a fake promise to avoid the promise constructor
  // being called with `new Promise` in the browser.
  return {
    then(resolve: (value: T) => any) {
      if (resolve) {
        const callbackResult = resolve(value);
        if (isPromise(callbackResult)) {
          return callbackResult;
        }
        return fakePromise(callbackResult);
      }
      return this;
    },
    catch() {
      return this;
    },
    finally(cb) {
      if (cb) {
        const callbackResult = cb();
        if (isPromise(callbackResult)) {
          return callbackResult.then(
            () => value,
            () => value,
          );
        }
        return fakePromise(value);
      }
      return this;
    },
    [Symbol.toStringTag]: 'Promise',
  };
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
  callback: (input: TInput, endEarly: VoidFunction, index: number) => MaybePromise<TOutput>,
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
      () => callback(value, endEarly, index++),
      result => {
        if (endedEarly) {
          return;
        }
        if (result) {
          results?.push(result);
        }
        return iterate();
      },
    );
  }
  return iterate();
}

export function fakeRejectPromise(error: unknown): Promise<never> {
  if (isPromise(error)) {
    return error as Promise<never>;
  }
  return {
    then() {
      return this;
    },
    catch(reject: (error: unknown) => any) {
      if (reject) {
        return fakePromise(reject(error));
      }
      return this;
    },
    finally(cb) {
      if (cb) {
        cb();
      }
      return this;
    },
    [Symbol.toStringTag]: 'Promise',
  };
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
