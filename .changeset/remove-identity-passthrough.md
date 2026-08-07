---
'@whatwg-node/node-fetch': patch
---

Improve unused fetch-response cleanup without breaking streaming bodies.

The `ClientRequest`/`curl` error listener is cleared when headers arrive so the fetch
`Promise` cannot retain the `Response` forever while the body stays unread. Unread
bodies also register a `FinalizationRegistry` fallback (`resume()`). An identity
`PassThrough` (or zlib decode stream) still wraps the Node response so keep-alive
sockets are drained when the body is never read — eager `arrayBuffer()` drain was
tried and rejected because it breaks abort/stream consumption.
