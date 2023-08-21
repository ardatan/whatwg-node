---
'@whatwg-node/node-fetch': patch
'@whatwg-node/server': patch
---

Do not create a new Buffer to uWS and node-http, and use the existing Buffer instead for better performance in Node.js.
