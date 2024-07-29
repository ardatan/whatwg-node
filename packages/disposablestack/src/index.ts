import { PonyfillAsyncDisposableStack } from './AsyncDisposableStack.js';
import { PonyfillDisposableStack } from './DisposableStack.js';

export const DisposableStack = globalThis.DisposableStack || PonyfillDisposableStack;
export const AsyncDisposableStack = globalThis.AsyncDisposableStack || PonyfillAsyncDisposableStack;
export * from './symbols.js';
