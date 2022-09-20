---
'@whatwg-node/server': patch
---

- Set ServerContext to an empty object by default for .fetch method
- Do not call request handler twice which causes an error `disturbed`
