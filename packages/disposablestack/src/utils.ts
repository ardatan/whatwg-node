import { DisposableSymbols } from './symbols';

export function isSyncDisposable(obj: any): obj is Disposable {
  return obj?.[DisposableSymbols.dispose] != null;
}

export function isAsyncDisposable(obj: any): obj is AsyncDisposable {
  return obj?.[DisposableSymbols.asyncDispose] != null;
}

export type MaybePromise<T> = T | PromiseLike<T>;
