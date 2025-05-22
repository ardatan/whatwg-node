import { describe, expect, it } from '@jest/globals';
import { createCustomAbortControllerSignal } from '@whatwg-node/server';

describe('CustomAbortControllerSignal', () => {
  it('supports AbortSignal.any', async () => {
    const customCtrl = createCustomAbortControllerSignal();
    const ctrl2 = new AbortController();
    const signal2 = ctrl2.signal;
    const anySignal = AbortSignal.any([customCtrl.signal, signal2]);
    const reason = new Error('my reason');
    customCtrl.abort(reason);
    expect(anySignal.aborted).toBe(true);
    expect(anySignal.reason).toBe(reason);
    expect(signal2.aborted).toBe(false);
  });
});
