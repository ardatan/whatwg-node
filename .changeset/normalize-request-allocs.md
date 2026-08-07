---
'@whatwg-node/server': patch
---

Cut allocations in `normalizeNodeRequest`.

On Node, request abort controllers use the native `AbortController` with
`kMaxEventTargetListeners = 0` (same unlimited-listener behavior as before) instead of a
per-request `EventTarget` subclass wrapped in a `Proxy`. Abort wiring shares one
`error`/`close` listener and skips abort when `writableFinished` is set, instead of
installing a third `finish` listener. Parsed-body detection uses a short-circuiting
`for…in` check instead of `Object.keys(...).length`.
