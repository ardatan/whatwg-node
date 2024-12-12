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
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const thisSignal = this;
    function onAbort(ev: Event) {
      const signal = ev.target as AbortSignal;
      thisSignal.sendAbort(signal.reason);
      thisSignal.reason = signal.reason;
      thisSignal.aborted = true;
      for (const otherSignal of signals) {
        otherSignal.removeEventListener('abort', onAbort);
        if (otherSignal !== signal && !otherSignal.aborted) {
          if (otherSignal.sendAbort) {
            otherSignal.sendAbort(signal.reason);
          }
          otherSignal.reason = signal.reason;
          otherSignal.aborted = true;
        }
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
