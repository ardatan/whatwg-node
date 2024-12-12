import { DisposableSymbols } from '@whatwg-node/disposablestack';
import { PonyfillAbortError } from './AbortError.js';

export class PonyfillAbortSignal extends EventTarget implements AbortSignal {
  aborted = false;
  private _onabort: ((this: AbortSignal, ev: Event) => any) | null = null;
  reason: any;

  constructor(...signals: PonyfillAbortSignal[]) {
    super();
    if (signals.length) {
      return this.any(signals);
    }
  }

  throwIfAborted(): void {
    if (this.aborted) {
      throw this.reason;
    }
  }

  sendAbort(reason?: any) {
    if (!this.aborted) {
      this.reason = reason || new PonyfillAbortError();
      this.aborted = true;
      const event = new Event('abort');
      this.dispatchEvent(event);
    }
  }

  get onabort() {
    return this._onabort;
  }

  set onabort(value) {
    this._onabort = value;
    if (value) {
      this.addEventListener('abort', value);
    } else {
      this.removeEventListener('abort', value);
    }
  }

  any(signals: Iterable<PonyfillAbortSignal>): PonyfillAbortSignal {
    function onAbort(this: PonyfillAbortSignal, ev: Event) {
      const signal = (ev.target as AbortSignal) || this;
      this.sendAbort(signal.reason);
      for (const signal of signals) {
        signal.removeEventListener('abort', onAbort);
        signal.reason = this.reason;
        if (signal.sendAbort) {
          signal.sendAbort(this.reason);
        }
        signal.aborted = true;
      }
    }
    for (const signal of signals) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
    return this;
  }

  static timeout(ms: number): AbortSignal {
    const signal = new PonyfillAbortSignal();
    const timeout = setTimeout(() => {
      signal.sendAbort();
      signal.removeEventListener('abort', onAbort);
    }, ms);
    function onAbort() {
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
    }
    signal.addEventListener('abort', onAbort, { once: true });
    return signal;
  }

  static any(signals: Iterable<PonyfillAbortSignal>): PonyfillAbortSignal {
    return new PonyfillAbortSignal(...signals);
  }

  [DisposableSymbols.dispose]() {
    return this.sendAbort();
  }
}
