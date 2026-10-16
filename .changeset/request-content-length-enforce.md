---
'@whatwg-node/node-fetch': minor
'@whatwg-node/server': minor
---

Enforce `Content-Length` while reading Request bodies, and trust it in `useLimitRequestBodySize` when present.

`@whatwg-node/node-fetch` now fails fast with `ContentLengthMismatchError` as soon as a Request body would deliver more bytes than a caller-supplied `Content-Length` header (and also if the stream ends short). Response bodies are not enforced. That makes the header a reliable size signal for the ponyfill `Request`.

`useLimitRequestBodySize` therefore applies the limit from `Content-Length` alone when the header is present and valid, without replacing the `Request` (preserving identity). Streaming byte-counting remains only for requests without `Content-Length` (e.g. chunked).

`useContentEncoding` deletes `Content-Length` after decompressing a request body so downstream limiters count decoded bytes instead of trusting the compressed wire length.

uWebSockets request adaptation no longer keeps a synthetic `Content-Length: 0` from ponyfill Request construction when the client omitted the header (body is attached via accessors).
