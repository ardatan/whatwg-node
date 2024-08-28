import { PonyfillSuppressedError } from './SupressedError.js';
import { DisposableSymbols } from './symbols.js';
import { isAsyncDisposable, isSyncDisposable, MaybePromise } from './utils.js';

const SuppressedError = globalThis.SuppressedError || PonyfillSuppressedError;

export class PonyfillAsyncDisposableStack implements AsyncDisposableStack {
  private callbacks: (() => MaybePromise<void>)[] = [];
  get disposed(): boolean {
    return this.callbacks.length === 0;
  }

  use<T extends AsyncDisposable | Disposable | null | undefined>(value: T): T {
    if (isAsyncDisposable(value)) {
      this.callbacks.push(() => value[DisposableSymbols.asyncDispose]());
    } else if (isSyncDisposable(value)) {
      this.callbacks.push(() => value[DisposableSymbols.dispose]());
    }
    return value;
  }

  adopt<T>(value: T, onDisposeAsync: (value: T) => MaybePromise<void>): T {
    if (onDisposeAsync) {
      this.callbacks.push(() => onDisposeAsync(value));
    }
    return value;
  }

  defer(onDisposeAsync: () => MaybePromise<void>): void {
    if (onDisposeAsync) {
      this.callbacks.push(onDisposeAsync);
    }
  }

  move(): AsyncDisposableStack {
    const stack = new PonyfillAsyncDisposableStack();
    stack.callbacks = this.callbacks;
    this.callbacks = [];
    return stack;
  }

  disposeAsync(): Promise<void> {
    return this[DisposableSymbols.asyncDispose]();
  }

  private _error?: Error;

  private _iterateCallbacks(): MaybePromise<void> {
    const cb = this.callbacks.pop();
    if (cb) {
      try {
        const res$ = cb();
        if (res$?.then) {
          return res$.then(
            () => this._iterateCallbacks(),
            error => {
              this._error = this._error ? new SuppressedError(error, this._error) : error;
              return this._iterateCallbacks();
            },
          );
        }
      } catch (error: any) {
        this._error = this._error ? new SuppressedError(error, this._error) : error;
      }
      return this._iterateCallbacks();
    }
  }

  [DisposableSymbols.asyncDispose](): Promise<void> {
    const res$ = this._iterateCallbacks();
    if (res$?.then) {
      return res$.then(() => {
        if (this._error) {
          const error = this._error;
          this._error = undefined;
          throw error;
        }
      }) as Promise<void>;
    }
    if (this._error) {
      const error = this._error;
      this._error = undefined;
      throw error;
    }
    return undefined as any as Promise<void>;
  }

  readonly [Symbol.toStringTag]: string = 'AsyncDisposableStack';
}
