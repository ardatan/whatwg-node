import { isSyncDisposable, patchSymbols } from './utils.js';

patchSymbols();

export class PonyfillDisposableStack implements DisposableStack {
  private callbacks: (() => void)[] = [];
  get disposed(): boolean {
    return false;
  }

  dispose(): void {
    for (const cb of this.callbacks) {
      cb();
    }
    this.callbacks = [];
  }

  use<T extends Disposable | null | undefined>(value: T): T {
    if (isSyncDisposable(value)) {
      this.callbacks.push(() => value[Symbol.dispose]());
    }
    return value;
  }

  adopt<T>(value: T, onDispose: (value: T) => void): T {
    this.callbacks.push(() => onDispose(value));
    return value;
  }

  defer(onDispose: () => void): void {
    this.callbacks.push(onDispose);
  }

  move(): DisposableStack {
    const stack = new PonyfillDisposableStack();
    stack.callbacks = this.callbacks;
    this.callbacks = [];
    return stack;
  }

  [Symbol.dispose](): void {
    this.dispose();
  }

  readonly [Symbol.toStringTag]: string = 'DisposableStack';
}
