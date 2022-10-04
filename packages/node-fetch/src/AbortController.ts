import { PonyfillAbortSignal } from './AbortSignal';

// Will be removed after v14 reaches EOL
export class PonyfillAbortController implements AbortController {
  signal = new PonyfillAbortSignal();
  abort(reason?: any) {
    this.signal.abort(reason);
  }
}
