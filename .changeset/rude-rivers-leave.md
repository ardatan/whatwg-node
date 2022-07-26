---
'@whatwg-node/server': patch
---

Use '.originalUrl' if possible to get `Request.url` properly because some frameworks like Express are sending `/` to `url`
