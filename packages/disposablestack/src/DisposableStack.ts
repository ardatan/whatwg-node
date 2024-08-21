import { DisposableSymbols } from './symbols.js';
import { isSyncDisposable } from './utils.js';

export class PonyfillDisposableStack implements DisposableStack {
  private callbacks: (() => void)[] = [];
  get disposed(): boolean {
    return this.callbacks.length === 0;
  }

  use<T extends Disposable | null | undefined>(value: T): T {
    if (isSyncDisposable(value)) {
      this.callbacks.push(() => value[DisposableSymbols.dispose]());
    }
    return value;
  }

  adopt<T>(value: T, onDispose: (value: T) => void): T {
    if (onDispose) {
      this.callbacks.push(() => onDispose(value));
    }
    return value;
  }

  defer(onDispose: () => void): void {
    if (onDispose) {
      this.callbacks.push(onDispose);
    }
  }

  move(): DisposableStack {
    const stack = new PonyfillDisposableStack();
    stack.callbacks = this.callbacks;
    this.callbacks = [];
    return stack;
  }

  dispose(): void {
    return this[DisposableSymbols.dispose]();
  }

  private _error?: Error;

  private _iterateCallbacks(): void {
    const cb = this.callbacks.pop();
    if (cb) {
      try {
        cb();
      } catch (error: any) {
        this._error = this._error ? new SuppressedError(error, this._error) : error;
      }
      return this._iterateCallbacks();
    }
  }

  [DisposableSymbols.dispose](): void {
    this._iterateCallbacks();
    if (this._error) {
      const error = this._error;
      this._error = undefined;
      throw error;
    }
  }

  readonly [Symbol.toStringTag]: string = 'DisposableStack';
}
