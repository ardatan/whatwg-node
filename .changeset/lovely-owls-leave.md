---
'@whatwg-node/node-fetch': patch
'@whatwg-node/server': patch
---

Return `Buffer` instead of `ArrayBuffer` in `.arrayBuffer` due to a bug in Node.js that returns a
bigger ArrayBuffer causing memory overflow
