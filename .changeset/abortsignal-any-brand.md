---
'@whatwg-node/server': patch
---

Make `createCustomAbortControllerSignal().signal` always return a native `AbortSignal` so it passes Node.js's `#brand` check in `AbortSignal.any` (Node v26.10+, nodejs/node#65846).
