export type MaybePromise<T> = Promise<T> | T;
export type MaybePromiseLike<T> = PromiseLike<T> | T;

const kFakePromise = Symbol.for('@whatwg-node/promise-helpers/FakePromise');

export function isPromise<T>(value: MaybePromise<T>): value is Promise<T>;
export function isPromise<T>(value: MaybePromiseLike<T>): value is PromiseLike<T>;
export function isPromise<T>(value: MaybePromiseLike<T>): value is PromiseLike<T> {
  const maybePromise = value as any;
  return typeof maybePromise?.then === 'function';
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
  // When a finally callback is present, keep the fake-promise chain so cleanup
  // semantics stay identical (including async finally and success/error throws).
  if (finallyFactory) {
    let result$ = fakePromise().then(inputFactory).then(outputSuccessFactory, outputErrorFactory);
    result$ = result$.finally(finallyFactory);
    return unfakePromise(result$);
  }

  // Sync-friendly path: call the factories directly when the input is not a
  // thenable, so hot callers avoid allocating temporary fake-promise wrappers.
  // onError still only handles inputFactory failures / rejected inputs, and
  // thenable-detection failures (e.g. a throwing `then` getter), matching the
  // previous fake-promise chain. Success-factory throws are not routed to
  // onError (same as Promise#then(success, onError)).
  let input: MaybePromiseLike<TInput>;
  let inputIsPromise: boolean;
  try {
    // Match fakePromise().then(inputFactory): the resolved undefined is passed
    // through, so factories that inspect arguments.length still see one argument.
    input = (inputFactory as (value: undefined) => MaybePromiseLike<TInput>)(undefined);
    // Keep thenable detection inside this boundary: accessing `then` can throw.
    inputIsPromise = isPromise(input);
  } catch (err) {
    if (!outputErrorFactory) {
      throw err;
    }
    const output = outputErrorFactory(err);
    return isPromise(output) ? unfakePromise(fakePromise(output)) : output;
  }

  if (!inputIsPromise) {
    const output = outputSuccessFactory(input as TInput);
    return isPromise(output) ? unfakePromise(fakePromise(output)) : output;
  }

  return unfakePromise(fakePromise(input).then(outputSuccessFactory, outputErrorFactory));
}

/**
 * Resolved fake-promise instances share one hidden class: methods live on the
 * prototype instead of as own properties of a fresh object literal each call.
 */
class FakePromise<T = unknown> implements Promise<T> {
  __fakePromiseValue: T;
  // Brand checked by unfakePromise / isFakePromise
  [kFakePromise]: 'resolved';

  constructor(value: T) {
    this.__fakePromiseValue = value;
    this[kFakePromise] = 'resolved';
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    _onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    if (onfulfilled) {
      try {
        return fakePromise(onfulfilled(this.__fakePromiseValue)) as Promise<TResult1 | TResult2>;
      } catch (err) {
        return fakeRejectPromise(err);
      }
    }
    return this as unknown as Promise<TResult1 | TResult2>;
  }

  catch<TResult = never>(
    _onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<T | TResult> {
    return this as unknown as Promise<T | TResult>;
  }

  finally(onfinally?: (() => void) | null): Promise<T> {
    if (onfinally) {
      try {
        const value = this.__fakePromiseValue;
        return fakePromise(onfinally()).then(
          () => value,
          () => value,
        ) as Promise<T>;
      } catch (err) {
        return fakeRejectPromise(err);
      }
    }
    return this;
  }

  get [Symbol.toStringTag]() {
    return 'Promise';
  }
}

/**
 * Rejected fake-promise instances - same shared-prototype rationale as
 * {@link FakePromise}.
 */
class FakeRejectPromise<T = never> implements Promise<T> {
  __fakeRejectError: unknown;
  [kFakePromise]: 'rejected';

  constructor(error: unknown) {
    this.__fakeRejectError = error;
    this[kFakePromise] = 'rejected';
  }

  then<TResult1 = T, TResult2 = never>(
    _onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    if (onrejected) {
      try {
        return fakePromise(onrejected(this.__fakeRejectError)) as Promise<TResult1 | TResult2>;
      } catch (err) {
        return fakeRejectPromise(err);
      }
    }
    return this as unknown as Promise<TResult1 | TResult2>;
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<T | TResult> {
    if (onrejected) {
      try {
        return fakePromise(onrejected(this.__fakeRejectError)) as Promise<T | TResult>;
      } catch (err) {
        return fakeRejectPromise(err);
      }
    }
    return this as unknown as Promise<T | TResult>;
  }

  finally(onfinally?: (() => void) | null): Promise<T> {
    if (onfinally) {
      try {
        onfinally();
      } catch (err) {
        return fakeRejectPromise(err);
      }
    }
    return this;
  }

  get [Symbol.toStringTag]() {
    return 'Promise';
  }
}

/**
 * Thin wrapper around a foreign thenable so method shapes stay on a shared
 * prototype (same V8 rationale as {@link FakePromise}).
 */
class ThenableFakePromise<T = unknown> implements Promise<T> {
  private _thenable: PromiseLike<T>;

  constructor(thenable: PromiseLike<T>) {
    this._thenable = thenable;
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return fakePromise(this._thenable.then(onfulfilled, onrejected));
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<T | TResult> {
    return fakePromise(this._thenable.then(res => res, onrejected));
  }

  finally(onfinally?: (() => void) | null): Promise<T> {
    return fakePromise(onfinally ? promiseLikeFinally(this._thenable, onfinally) : this._thenable);
  }

  get [Symbol.toStringTag]() {
    return 'Promise';
  }
}

export function fakePromise<T>(value: MaybePromise<T>): Promise<T>;
export function fakePromise<T>(value: MaybePromiseLike<T>): Promise<T>;
export function fakePromise(value: void): Promise<void>;
export function fakePromise<T>(value: MaybePromiseLike<T>): Promise<T> {
  if (value && isActualPromise(value)) {
    return value;
  }

  if (isPromise(value)) {
    return new ThenableFakePromise(value) as Promise<T>;
  }

  // Avoid `new Promise` for already-resolved values; shared prototype keeps a
  // stable V8 hidden class across hot sync call sites.
  return new FakePromise(value as T) as Promise<T>;
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
  return new FakeRejectPromise(error) as Promise<T>;
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
    let onEndWithValueResult: any; /** R in onEndWithValue */
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
  return (value as any)?.[kFakePromise] === 'resolved';
}

function isFakeRejectPromise(value: any): value is Promise<never> & { __fakeRejectError: any } {
  return (value as any)?.[kFakePromise] === 'rejected';
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
