import { PonyfillAsyncDisposableStack } from './AsyncDisposableStack.js';
import { PonyfillDisposableStack } from './DisposableStack.js';
import { patchSymbols } from './utils.js';

patchSymbols();

export const DisposableStack = globalThis.DisposableStack || PonyfillDisposableStack;
export const AsyncDisposableStack = globalThis.AsyncDisposableStack || PonyfillAsyncDisposableStack;
