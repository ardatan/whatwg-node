export type MaybePromise<T> = Promise<T> | T;
export type MaybePromiseLike<T> = PromiseLike<T> | T;

export function isPromise<T>(value: MaybePromise<T>): value is Promise<T> {
  return isPromiseLike(value);
}

export function isPromiseLike<T>(value: MaybePromiseLike<T>): value is PromiseLike<T> {
  return (value as PromiseLike<T>)?.then != null;
}

export function handleMaybePromiseLike<TInput, TOutput>(
  inputFactory: () => MaybePromiseLike<TInput>,
  outputSuccessFactory: (value: TInput) => MaybePromiseLike<TOutput>,
  outputErrorFactory?: (err: any) => MaybePromiseLike<TOutput>,
): MaybePromiseLike<TOutput> {
  function _handle() {
    const input$ = inputFactory();
    if (isPromiseLike(input$)) {
      return input$.then(outputSuccessFactory, outputErrorFactory);
    }
    return outputSuccessFactory(input$);
  }
  if (!outputErrorFactory) {
    return _handle();
  }
  try {
    return _handle();
  } catch (err) {
    return outputErrorFactory(err);
  }
}

export function handleMaybePromise<TInput, TOutput>(
  inputFactory: () => MaybePromise<TInput>,
  outputSuccessFactory: (value: TInput) => MaybePromise<TOutput>,
  outputErrorFactory?: (err: any) => MaybePromise<TOutput>,
): MaybePromise<TOutput> {
  return handleMaybePromiseLike(
    inputFactory,
    outputSuccessFactory,
    outputErrorFactory,
  ) as MaybePromise<TOutput>;
}

export function fakePromise<T>(value: T): Promise<T> {
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
          return callbackResult.then(() => value);
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

export function iterateAsyncVoid<TInput>(
  iterable: Iterable<TInput>,
  callback: (input: TInput, stopEarly: () => void) => Promise<void> | void,
): Promise<void> | void {
  const iterator = iterable[Symbol.iterator]();
  let stopEarlyFlag = false;
  function stopEarlyFn() {
    stopEarlyFlag = true;
  }
  function iterate(): Promise<void> | void {
    const { done: endOfIterator, value } = iterator.next();
    if (endOfIterator) {
      return;
    }
    return handleMaybePromise(
      () => callback(value, stopEarlyFn),
      () => {
        if (stopEarlyFlag) {
          return;
        }
        return iterate();
      },
    );
  }
  return iterate();
}
