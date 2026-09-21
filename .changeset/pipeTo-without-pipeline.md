---
'@whatwg-node/node-fetch': patch
---

Avoid `stream/promises.pipeline` in `ReadableStream.pipeTo` / `pipeThrough`. The promise pipeline allocates and aborts an `AbortController` on teardown (expensive `DOMException` stack capture), which dominated cost for short TransformStream pipes such as request body size limiting. Use Node `.pipe()` with explicit error/finish handling instead, while still rejecting when the destination write fails.
