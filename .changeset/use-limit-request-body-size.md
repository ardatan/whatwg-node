---
'@whatwg-node/server': minor
---

Add `useLimitRequestBodySize` to reject oversized request bodies early via `Content-Length`, and while streaming with a byte-counting `TransformStream` (so a short or missing `Content-Length` cannot bypass the limit).

Optional `responseFromError` customizes the early-reject `Response` (e.g. GraphQL error JSON in Yoga).

If you also use `useContentEncoding`, put it before `useLimitRequestBodySize` in the `plugins` array so the limit applies to decoded body bytes.
