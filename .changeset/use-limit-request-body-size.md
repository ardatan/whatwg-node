---
'@whatwg-node/server': minor
---

Add `useLimitRequestBodySize` to reject oversized request bodies early via `Content-Length` and while streaming, using `RequestBodyTooLargeError` / `InvalidContentLengthError`.

Optional `responseFromError` customizes the early-reject `Response` (e.g. GraphQL error JSON in Yoga).
