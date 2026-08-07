---
'@whatwg-node/server': patch
---

Hoist private header-object reads in `sendNodeResponse`.

The single-`writeHead` fast path repeatedly touched `fetchResponse.headers.headersInit` / `_map` / `_setCookies`; reading them once into locals keeps a stable shape for the branch and avoids redundant property loads on the static-response path.
