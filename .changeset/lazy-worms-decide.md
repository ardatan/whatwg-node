---
'@whatwg-node/fetch': patch
---

Add `skipPonyfill` flag to `createFetch` to skip ponyfills and use the native Fetch implementation
for Node.js
