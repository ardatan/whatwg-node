---
'@whatwg-node/node-fetch': minor
'@whatwg-node/fetch': minor
---

Drop the optional `node-libcurl` dependency.

The ponyfill HTTP transport now always uses `node:http` / `node:https`. The `fetchCurl` code path and the `globalThis.libcurl` runtime check have been removed.

HTTP/2 support that previously came from `node-libcurl` is no longer available in this release; a follow-up adds optional undici-based transport (including HTTP/2).

If you were relying on `node-libcurl` being picked up automatically, the ponyfill will now use the built-in Node.js HTTP stack instead.
