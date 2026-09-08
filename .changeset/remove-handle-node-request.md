---
'@whatwg-node/server': minor
---

**Breaking Change:** Remove deprecated `handleNodeRequest` in favor of `handleNodeRequestAndResponse`.

`adapter.handleNodeRequest(nodeRequest, ...ctx)` is gone. Prefer `handleNodeRequestAndResponse`, which also receives the Node response so request normalization (abort wiring, etc.) can use it.

**Before:**

```ts
const response = await adapter.handleNodeRequest(req, { userId: '1' })
```

**After:**

```ts
const response = await adapter.handleNodeRequestAndResponse(req, res, { userId: '1' })
```

Notes:

- Pass the real `ServerResponse` / `Http2ServerResponse` (or a container with `{ raw: res }`) as the second argument.
- Like before, this returns a WHATWG `Response` and does **not** write it to `res`. Use `adapter(req, res)`, `adapter.requestListener`, or `adapter.handle(req, res)` when you want the adapter to send the response.
