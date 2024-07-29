import { AsyncDisposableStack, DisposableStack } from '../src';

describe('DisposableStack', () => {
  it('use', () => {
    const stack = new DisposableStack();
    const disposeFn = jest.fn();
    stack.use({
      [Symbol.dispose]: disposeFn,
    });
  });
  it('adopt', () => {
    const stack = new DisposableStack();
    const disposeFn = jest.fn();
    const value = {};
    stack.adopt(value, disposeFn);
    stack.dispose();
    expect(disposeFn).toBeCalledWith(value);
  });
  it('defer', () => {
    const stack = new DisposableStack();
    const disposeFn = jest.fn();
    stack.defer(disposeFn);
    stack.dispose();
    expect(disposeFn).toBeCalled();
  });
  it('move', () => {
    const stack = new DisposableStack();
    const disposeFn = jest.fn();
    stack.defer(disposeFn);
    const stack2 = stack.move();
    expect(disposeFn).not.toBeCalled();
    stack2.dispose();
    expect(disposeFn).toBeCalled();
  });
});

describe('AsyncDisposableStack', () => {
  it('use', async () => {
    const stack = new AsyncDisposableStack();
    const disposeFn = jest.fn();
    stack.use({
      [Symbol.asyncDispose]: disposeFn,
    });
    await stack.disposeAsync();
    expect(disposeFn).toBeCalled();
  });
  it('adopt', async () => {
    const stack = new AsyncDisposableStack();
    const disposeFn = jest.fn();
    const value = {};
    stack.adopt(value, disposeFn);
    await stack.disposeAsync();
    expect(disposeFn).toBeCalledWith(value);
  });
  it('defer', async () => {
    const stack = new AsyncDisposableStack();
    const disposeFn = jest.fn();
    stack.defer(disposeFn);
    await stack.disposeAsync();
    expect(disposeFn).toBeCalled();
  });
  it('move', async () => {
    const stack = new AsyncDisposableStack();
    const disposeFn = jest.fn();
    stack.defer(disposeFn);
    const stack2 = stack.move();
    await stack.disposeAsync();
    expect(disposeFn).not.toBeCalled();
    await stack2.disposeAsync();
    expect(disposeFn).toBeCalled();
  });
});
