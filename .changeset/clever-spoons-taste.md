---
'@whatwg-node/node-fetch': patch
'@whatwg-node/fetch': patch
---

Pass errors to ReadableStream's cancel method properly when it is piped, and piped stream is
cancelled

Implement `ReadableStream.from`