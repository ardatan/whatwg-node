---
'@whatwg-node/node-fetch': patch
'@whatwg-node/fetch': patch
'@whatwg-node/server': patch
---

- Improve native ReadableStream handling inside ponyfills
- Use `waitUntil` instead of floating promises
- Handle early termination in `WritableStream`
- Handle `waitUntil` correctly within a dummy call of `ServerAdapter.fetch` method