---
'@whatwg-node/promise-helpers': patch
---

Use shared prototype classes for `fakePromise` / `fakeRejectPromise` instances.

Resolved and rejected fake promises (and foreign-thenable wrappers) are no longer allocated as object literals with own `then`/`catch`/`finally` methods. A shared constructor keeps a stable V8 hidden class while preserving the same brand (`Symbol.for`) and unwrapping behavior.
