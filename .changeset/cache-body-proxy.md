---
'@whatwg-node/node-fetch': patch
---

Cache the `body` Proxy while the underlying Node readable is unchanged.

Repeated `body` accesses no longer allocate a fresh Proxy (and method binds) on every get when the generated stream identity is stable.
