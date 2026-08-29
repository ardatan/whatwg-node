---
'@whatwg-node/promise-helpers': patch
---

Avoid allocating `fakePromise` wrappers in `handleMaybePromise` when there is no `finallyFactory`.

Synchronous values complete inline; real Promises use native `.then()`. The previous chain is kept only when a `finallyFactory` is provided so `finally` semantics stay the same.
