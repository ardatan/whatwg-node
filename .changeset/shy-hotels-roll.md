---
'@whatwg-node/server': patch
---

Wait for remaining promises during `asyncDispose` correctly

The `asyncDispose` function should wait for all remaining promises to resolve before returning. This ensures that the server is fully disposed of before the function returns.

```ts
import { createServerAdapter } from '@whatwg-node/server';

const deferred = Promise.withResolvers();

const adapter = createServerAdapter((req, ctx) => {
    ctx.waitUntil(deferred.promise);
    return new Response('Hello, world!');
});

const res = await adapter.fetch('http://example.com');
console.assert(res.status === 200);
console.assert(await res.text() === 'Hello, world!');

let disposed = false;
adapter[Symbol.asyncDispose]().then(() => {
    disposed = true;
});

console.assert(!disposed);

deferred.resolve();

console.assert(disposed);
```