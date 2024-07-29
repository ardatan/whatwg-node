import { DisposableSymbols } from './symbols.js';
import { isAsyncDisposable, isSyncDisposable, MaybePromise } from './utils.js';

export class PonyfillAsyncDisposableStack implements AsyncDisposableStack {
  private callbacks: (() => MaybePromise<void>)[] = [];
  get disposed(): boolean {
    return false;
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
    this.callbacks.push(() => onDisposeAsync(value));
    return value;
  }

  defer(onDisposeAsync: () => MaybePromise<void>): void {
    this.callbacks.push(onDisposeAsync);
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

  async [DisposableSymbols.asyncDispose](): Promise<void> {
    for (const cb of this.callbacks) {
      await cb();
    }
  }

  readonly [Symbol.toStringTag]: string = 'AsyncDisposableStack';
}
