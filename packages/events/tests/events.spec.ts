import { CustomEvent } from '@whatwg-node/events';

describe('CustomEvent', () => {
  it('detail should be set', () => {
    const target = new EventTarget();
    const listener = jest.fn();
    target.addEventListener('test', listener);
    target.dispatchEvent(new CustomEvent('test', { detail: 123 }));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: 123 }));
  });
  it('detail should be null by default', () => {
    const target = new EventTarget();
    const listener = jest.fn();
    target.addEventListener('test', listener);
    target.dispatchEvent(new CustomEvent('test'));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: null }));
  });
});
