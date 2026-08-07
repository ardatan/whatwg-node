---
'@whatwg-node/server': patch
---

Reduce per-request work in the Node `requestListener` hot path.

`normalizeNodeRequest` / `handleRequest` are inlined for the common empty-`ctx` case so we skip rest-parameter array forwarding through `handleNodeRequestAndResponse`, error handlers and passthrough helpers are allocated once per module/adapter instead of once per request, and the listener composes with `handleMaybePromise` so sync `sendNodeResponse` completions avoid `fakePromise` wrappers.
