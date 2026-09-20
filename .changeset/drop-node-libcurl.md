---
'@whatwg-node/node-fetch': minor
'@whatwg-node/fetch': minor
---

Drop the optional `node-libcurl` dependency.

The ponyfill HTTP transport now always uses `node:http` / `node:https`. The `fetchCurl` code path, the `globalThis.libcurl` runtime check, and the CI `libcurl4-openssl-dev` install steps have been removed.

If you were relying on `node-libcurl` being picked up automatically, the ponyfill will now use the built-in Node.js HTTP stack instead.
