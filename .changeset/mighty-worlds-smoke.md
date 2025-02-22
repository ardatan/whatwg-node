---
'@whatwg-node/node-fetch': patch
'@whatwg-node/server': patch
'@whatwg-node/fetch': patch
---

Fixes the `TypeError: bodyInit.stream is not a function` error thrown when the incoming HTTP/2 request is attempted to parse.
