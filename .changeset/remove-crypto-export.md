---
'@whatwg-node/fetch': minor
'@whatwg-node/server': patch
---

Stop exporting `crypto` from `@whatwg-node/fetch` (and from `createFetch` / `FetchAPI`). Use `globalThis.crypto` instead; it is available on all supported runtimes (Node.js >=22.15).
