---
'@whatwg-node/server': patch
'@whatwg-node/node-fetch': patch
---

- Use native AbortSignal and AbortController for Request.signal
- Remove custom AbortSignal implementation (ServerAdapterAbortSignal)