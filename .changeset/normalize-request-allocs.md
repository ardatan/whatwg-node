---
'@whatwg-node/server': patch
---

Cut allocations in `normalizeNodeRequest`.

Abort wiring shares one `error`/`close` listener with a `finish` flag instead of installing a third listener that calls `removeListener` (runs on every Node request with a response). Parsed-body detection uses a short-circuiting `for…in` check instead of `Object.keys(...).length`, and only runs after the GET/HEAD early return when `nodeRequest.body` is non-null.
