---
'@whatwg-node/promise-helpers': patch
---

Avoid `fakePromise` wrapper allocations in `handleMaybePromise` when there is no `finallyFactory`.

Synchronous values and `fakePromise` / `fakeRejectPromise` results are unwrapped and handled inline; real Promises use native `.then()`. The previous `fakePromise().then(...)` chain is kept only when a `finallyFactory` is provided so `finally` semantics stay identical.
