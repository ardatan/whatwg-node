---
'@whatwg-node/node-fetch': patch
---

`new Request(request, init)` keeps the members of `request` that `init` does not set (method,
headers, body, signal and others) instead of dropping them, as native `fetch` does. The headers are
copied rather than shared, a replaced or dropped body gets its `Content-Length` recomputed, a
`GET`/`HEAD` request does not inherit a body, and `init.body: null` keeps the input body.
