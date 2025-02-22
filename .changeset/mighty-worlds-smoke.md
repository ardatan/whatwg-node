---
'@whatwg-node/node-fetch': patch
'@whatwg-node/server': patch
'@whatwg-node/fetch': patch
---

Fixes the `TypeError: bodyInit.stream is not a function` error thrown when `@whatwg-node/server` is used with `node:http2` and attempts the incoming HTTP/2 request to parse with `Request.json`, `Request.text`, `Request.formData`, or `Request.blob` methods.
