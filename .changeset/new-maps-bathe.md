---
'@whatwg-node/node-fetch': patch
'@whatwg-node/fetch': patch
'@whatwg-node/server': patch
---

Avoid using `.toArray()` method of Node's `Readable` which is expensive
