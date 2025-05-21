import { describe, expect, it } from '@jest/globals';
import { createCustomAbortControllerSignal } from '@whatwg-node/server';

describe('CustomAbortControllerSignal', () => {
  it('supports AbortSignal.any', async () => {
    const signal = createCustomAbortControllerSignal();
    const ctrl2 = new AbortController();
    const signal2 = ctrl2.signal;
    const anySignal = AbortSignal.any([signal, signal2]);
    signal.abort();
    expect(anySignal.aborted).toBe(true);
  });
});
