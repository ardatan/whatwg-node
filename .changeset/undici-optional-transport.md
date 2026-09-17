---
'@whatwg-node/node-fetch': minor
'@whatwg-node/fetch': minor
---

Replace optional `node-libcurl` transport with optional `undici`.

When `undici` is installed, `@whatwg-node/node-fetch` uses undici's low-level `dispatch` API with
`Agent.compose(dns, redirect, decompress)` (not `undici.fetch` / `request`) for HTTP(S), including
HTTP/2 via `allowH2`. Without `undici`, behavior falls back to `node:http` as before.
`node-libcurl` is no longer loaded or supported.
