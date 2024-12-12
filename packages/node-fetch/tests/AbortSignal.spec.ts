import { setTimeout } from 'timers/promises';
import { PonyfillAbortController } from '../src/AbortController';
import { PonyfillAbortSignal } from '../src/AbortSignal';

describe('AbortSignal', () => {
  it('any', () => {
    const ctrl1 = new PonyfillAbortController();
    const ctrl2 = new PonyfillAbortController();
    const combinedSignal = PonyfillAbortSignal.any([ctrl1.signal, ctrl2.signal]);
    let ev: Event | undefined;
    combinedSignal.addEventListener('abort', e => {
      ev = e;
    });
    ctrl1.abort('reason1');
    expect(combinedSignal.aborted).toBe(true);
    expect(combinedSignal.reason).toBe('reason1');
    expect(ev).toBeDefined();
    expect(ev?.type).toBe('abort');
    expect(ev?.target).toBe(combinedSignal);
  });
  it('timeout', async () => {
    const signal = PonyfillAbortSignal.timeout(100);
    expect(signal.aborted).toBe(false);
    await setTimeout(200);
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBeInstanceOf(DOMException);
    expect(signal.reason.name).toBe('TimeoutError');
    expect(signal.reason.message).toBe('The operation timed out.');
  });
});
