---
'@whatwg-node/server': patch
---

Cut allocations in `normalizeNodeRequest`.

Parsed-body detection uses a short-circuiting `for…in` check instead of `Object.keys(...).length`, and abort wiring shares one `error`/`close` listener with a `finish` flag instead of installing a third listener that calls `removeListener`. Both run on every Node request.
