import { DisposableSymbols } from './symbols.js';

export function isSyncDisposable(obj: any): obj is Disposable {
  return obj?.[DisposableSymbols.dispose] != null;
}

export function isAsyncDisposable(obj: any): obj is AsyncDisposable {
  return obj?.[DisposableSymbols.asyncDispose] != null;
}
