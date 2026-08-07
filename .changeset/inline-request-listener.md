---
'@whatwg-node/server': patch
---

Reduce per-request work in the Node `requestListener` hot path.

`normalizeNodeRequest` / `handleRequest` are inlined for the common empty-`ctx` case so we skip rest-parameter array forwarding through `handleNodeRequestAndResponse`, and error handlers are allocated once per adapter instead of once per request.
