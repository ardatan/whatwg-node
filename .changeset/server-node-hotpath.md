---
'@whatwg-node/server': patch
---

Reduce per-request work on the Node HTTP adapter path.

The common empty-context `requestListener` inlines normalize/handle and composes with `handleMaybePromise`, shared error handlers are allocated once, request abort uses the native `AbortController` with lighter close wiring, and `sendNodeResponse` hoists header reads on the single-`writeHead` fast path.
