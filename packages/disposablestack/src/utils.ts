export function isSyncDisposable(obj: any): obj is Disposable {
  return obj?.[Symbol.dispose] != null;
}

export function isAsyncDisposable(obj: any): obj is AsyncDisposable {
  return obj?.[Symbol.asyncDispose] != null;
}

export function patchSymbols() {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - we ponyfill these symbols
  Symbol.dispose ||= Symbol.for('dispose');
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - we ponyfill these symbols
  Symbol.asyncDispose ||= Symbol.for('asyncDispose');
}

export type MaybePromise<T> = T | PromiseLike<T>;
