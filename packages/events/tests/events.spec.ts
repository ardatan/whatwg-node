import { describe, expect, it, jest } from '@jest/globals';
import { CustomEvent } from '@whatwg-node/events';

describe('CustomEvent', () => {
  it('detail should be set', () => {
    const target = new EventTarget();
    let receivedEvent: CustomEvent | null = null;
    const listener = jest.fn(e => {
      receivedEvent = e as CustomEvent;
    });
    target.addEventListener('test', listener);
    target.dispatchEvent(new CustomEvent('test', { detail: 123 }));
    expect(receivedEvent).toBeInstanceOf(CustomEvent);
    expect(receivedEvent!.detail).toBe(123);
  });
  it('detail should be null by default', () => {
    const target = new EventTarget();
    let receivedEvent: CustomEvent | null = null;
    const listener = jest.fn(e => {
      receivedEvent = e as CustomEvent;
    });
    target.addEventListener('test', listener);
    target.dispatchEvent(new CustomEvent('test'));
    expect(receivedEvent).toBeInstanceOf(CustomEvent);
    expect(receivedEvent!.detail).toBeFalsy();
  });
});
