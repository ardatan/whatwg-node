---
'@whatwg-node/node-fetch': patch
---

### Faster HTTP Client experience in Node.js with HTTP/2 support

If you install `node-libcurl` seperately, `@whatwg-node/fetch` will select `libcurl` instead of `node:http` which is faster.

[See benchmarks](https://github.com/JCMais/node-libcurl/tree/develop/benchmark#ubuntu-1910-i7-5500u-24ghz---linux-530-42---node-v12162)
