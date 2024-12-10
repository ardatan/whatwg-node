---
'@whatwg-node/node-fetch': patch
---

`url.searchParams` parameter should reflect the changes in `toString()`

```ts
const url = new URL('http://example.com/?a=b');
url.searchParams.set('a', 'c');
console.log(url.toString()); // http://example.com/?a=c
```
