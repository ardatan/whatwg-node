---
'@whatwg-node/server': patch
---

Make `createCustomAbortControllerSignal().signal` always return a native `AbortSignal` so it passes Node.js's `#brand` check in `AbortSignal.any` (Node 26+).
