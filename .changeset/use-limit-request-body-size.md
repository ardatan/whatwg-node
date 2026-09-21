---
'@whatwg-node/server': minor
---

Add `useLimitRequestBodySize` to reject oversized request bodies early via `Content-Length`, and while streaming when `Content-Length` is missing or `Transfer-Encoding` / `Content-Encoding` is present.

When a valid `Content-Length` alone is within the limit, the body is not wrapped in a `TransformStream` (avoids per-request pipeline overhead). Optional `responseFromError` customizes the early-reject `Response` (e.g. GraphQL error JSON in Yoga).
