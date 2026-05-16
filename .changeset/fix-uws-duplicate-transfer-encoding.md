---
"@whatwg-node/server": patch
---

Fix duplicate `transfer-encoding: chunked` header when using uWebSockets.js. uWebSockets.js automatically adds this header when streaming via `write()` + `end()`, so forwarding it from the fetch response caused `chunked, chunked` which breaks strict load balancers (e.g. Google Cloud Load Balancer).
