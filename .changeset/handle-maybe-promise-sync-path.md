---
'@whatwg-node/promise-helpers': patch
---

Make `handleMaybePromise` avoid temporary fake-promise wrappers on the synchronous path.

When no `finally` callback is provided and the input factory returns a non-thenable value, success/error factories run directly. Promise, fake-promise, and custom thenable inputs still go through the existing normalization path.
