---
'@whatwg-node/node-fetch': patch
---

Collect `Readable` request bodies (such as Node `IncomingMessage`) directly in `json()` / `text()` / `arrayBuffer()` when `.body` has not been accessed, avoiding an intermediate `PonyfillReadableStream` on the common server POST path.
