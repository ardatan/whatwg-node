import { DisposableSymbols } from '@whatwg-node/disposablestack';
import { PonyfillAbortSignal } from './AbortSignal.js';

export class PonyfillAbortController implements AbortController {
  signal: PonyfillAbortSignal;
  constructor() {
    this.signal = new PonyfillAbortSignal();
  }

  abort(reason?: any) {
    return this.signal.sendAbort(reason);
  }

  [DisposableSymbols.dispose]() {
    return this.abort();
  }
}
