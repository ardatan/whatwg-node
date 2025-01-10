---
'@whatwg-node/node-fetch': patch
'@whatwg-node/fetch': patch
---

`ReadableStream`'s `Symbol.asyncIterator` now returns `AsyncIterableIterator` like before even if it
is ok to return `AsyncIterator` right now. It is safer to return `AsyncIterableIterator` because it is a common mistake to use `AsyncIterator` as `AsyncIterable`.