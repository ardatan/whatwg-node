---
'@whatwg-node/server': minor
---

If `fetch` is called with multiple arguments like `fetch(request, env, ctx)` (for example CF Workers do that),
the parameters after `request` will be merged and passed as a `ServerContext` to the provided `handleRequest` function.