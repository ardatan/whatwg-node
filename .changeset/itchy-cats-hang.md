---
'@whatwg-node/server': patch
---

Avoid mutating the static context

For example if the adapter receives the server object as the server context, it is isolated and the handler cannot mutate it, otherwise it will leak. Bun does that so this patch is needed to avoid leaking the server object.