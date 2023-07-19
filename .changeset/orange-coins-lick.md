---
'@whatwg-node/node-fetch': patch
---

Use `POSTFIELDS` for static results in `fetchCurl` to avoid using Node life-cycle whenever possible
(Performance optimization)
