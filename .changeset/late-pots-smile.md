---
'@whatwg-node/server': minor
---

Fix context type to expose the `waitUntil` method.

## Breaking Changes

The function `handleNodeRequest` has been removed. Please use `handleNodeRequestAndResponse` instead.