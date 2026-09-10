---
'@whatwg-node/node-fetch': patch
---

Make `ReadableStream.cancel(reason)` resolve successfully instead of rejecting when waiting for close after destroy.
