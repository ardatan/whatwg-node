---
'@whatwg-node/node-fetch': minor
'@whatwg-node/fetch': minor
---

Replace optional `node-libcurl` with optional `undici` (Node only).

When `undici` is installed under Node, `@whatwg-node/node-fetch` uses undici's low-level
`dispatch` API with `Agent.compose(dns, redirect, decompress)` (not `undici.fetch` / `request`)
for HTTP(S), including HTTP/2. After auto-decompress, `Content-Encoding` / `Content-Length` are
removed so the headers match the decoded body (same on the `node:http` fallback).

Without `undici`, or on Bun / Deno, behavior uses `node:http` or the runtime's native fetch as
before. `node-libcurl` is no longer loaded or supported.
