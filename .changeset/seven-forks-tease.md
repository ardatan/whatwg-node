---
'@whatwg-node/node-fetch': patch
---

Remove the event listener on the provided `AbortSignal` when `node-libcurl` is used, the connection finishes to prevent
potential memory leaks;

```ts
const res = await fetch(URL, { signal: new AbortController().signal });
// AbortController is never aborted, and HTTP request is done as expected successfully
```
