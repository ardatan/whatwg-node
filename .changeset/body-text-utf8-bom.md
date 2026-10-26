---
'@whatwg-node/node-fetch': patch
---

Skip a leading UTF-8 byte order mark in `text()` and `json()`, as UTF-8 decode does. A JSON body
that starts with a byte order mark made `json()` throw a `SyntaxError`.
