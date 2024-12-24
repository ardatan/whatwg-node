---
'@whatwg-node/server': patch
---

While calling `handleNodeRequest` or `handleNodeRequestAndResponse`, `waitUntil` is not added automatically as in `requestListener` for Node.js integration.
This change adds `waitUntil` into the `serverContext` if not present.

Fixes the issue with Fastify integration that uses the mentioned methods