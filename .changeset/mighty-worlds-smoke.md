---
'@whatwg-node/node-fetch': patch
'@whatwg-node/server': patch
'@whatwg-node/fetch': patch
---

Fix HTTP/2 body stream handling

This fixes the `TypeError: bodyInit.stream is not a function` error thrown when the incoming request is attempted to parse.
