---
'@whatwg-node/node-fetch': minor
'@whatwg-node/fetch': minor
---

Replace optional `node-libcurl` transport with optional `undici`.

When `undici` is installed, `@whatwg-node/node-fetch` uses `undici.request` (not `undici.fetch`) for
HTTP(S), including HTTP/2 via `allowH2`. Without `undici`, behavior falls back to `node:http` as
before. `node-libcurl` is no longer loaded or supported.
