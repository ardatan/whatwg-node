---
'@whatwg-node/node-fetch': patch
---

Cache the `PonyfillBody` `body` Proxy and its bound methods.

Repeated `.body` access (e.g. registering `data`/`end`/`error` listeners or internal reads during `pipe`) previously allocated a new Proxy and fresh `Function.prototype.bind` results on every property get. Reusing one proxy per underlying readable cuts allocation and GC pressure on stream-heavy request/response paths.
