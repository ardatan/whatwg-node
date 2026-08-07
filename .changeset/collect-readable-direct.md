---
'@whatwg-node/node-fetch': patch
---

Collect `Readable` request bodies without an intermediate `PonyfillReadableStream` when `.body` has not been accessed yet.

`json()` / `text()` / `arrayBuffer()` on Node `IncomingMessage` bodies previously always wrapped the stream before attaching `data`/`end` listeners. Reading `bodyInit` directly avoids that allocation on the common server POST path.
