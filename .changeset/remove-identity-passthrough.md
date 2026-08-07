---
'@whatwg-node/node-fetch': patch
---

Remove the identity `PassThrough` wrapper around uncompressed fetch response bodies.

`IncomingMessage` (and curl streams) are used directly as the response body; zlib decode streams remain when `Content-Encoding` requires them. After headers, the body is drained in the background into the Response buffer so keep-alive sockets are not pinned until GC (the previous PassThrough buffered for the same reason). `FinalizationRegistry` remains as a fallback, and the `ClientRequest`/`curl` error listener is cleared when headers arrive so the fetch `Promise` cannot retain the `Response` forever while the body is unread.
