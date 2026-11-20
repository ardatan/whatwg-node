---
'@whatwg-node/node-fetch': patch
---

Fix three differences from native `fetch`:

- `formData()` keeps every value of a repeated field or file instead of only the last one.
- Reading a `Blob` made from another `Blob` no longer throws a `ReferenceError`.
- A `URLSearchParams` body is serialized once, so `text()` returns a string, the request gets a
  `Content-Length`, and `fetch` can send it instead of failing with `ERR_INVALID_ARG_TYPE`.
