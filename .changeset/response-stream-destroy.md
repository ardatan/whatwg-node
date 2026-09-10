---
'@whatwg-node/server': patch
'@whatwg-node/node-fetch': patch
---

Destroy the Node response when the response body stream errors or is aborted, and propagate `Readable.destroy(err)` in the node-fetch stream ponyfill so piped sockets close with RST / ECONNRESET instead of hanging.

Also make ponyfill `ReadableStream.pipeTo()` reject when the destination write fails (after aborting the writer), instead of resolving successfully.
