---
"@whatwg-node/node-fetch": patch
---

PonyfillBlob extends native Blob

Now a Blob field can be checked against a native Blob implementation, _i.e._:

```ts
const body = new PonyfillBlob([])

if (body instanceof Blob)
  // ...
```
