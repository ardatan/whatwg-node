---
'@whatwg-node/node-fetch': patch
---

Remove the identity `PassThrough` wrapper around uncompressed fetch response bodies.

`IncomingMessage` (and curl streams) are used directly as the response body; zlib decode streams remain when `Content-Encoding` requires them. Unused bodies are released via `FinalizationRegistry` (`resume()`), and the `ClientRequest`/`curl` error listener is cleared when headers arrive so the fetch `Promise` cannot retain the `Response` forever while the body is unread.
