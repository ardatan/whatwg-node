---
'@whatwg-node/server': patch
---

Cut allocations in `normalizeNodeRequest`.

On Node, request abort controllers use the native `AbortController` with
`kMaxEventTargetListeners = 0` (same unlimited-listener behavior as before) instead of a
per-request `EventTarget` subclass wrapped in a `Proxy`. Abort wiring (shared
`error`/`close` listener, skip when `writableFinished`) runs for every Node request with
a response. Parsed-body detection uses a short-circuiting `for…in` check instead of
`Object.keys(...).length`, and only runs when `nodeRequest.body` is set after the
GET/HEAD early return.
