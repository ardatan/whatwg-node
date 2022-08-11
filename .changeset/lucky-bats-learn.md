---
'@whatwg-node/server': patch
---

Since Node 18 starts returning IPv6 in `socket.localAddress`, the generated URL was broken like `http://0.0.0.1:3000`.
Now it generates the URL of `Request` on Node 18 correctly. First we respect `host` header as recommended in [Node.js documentation](https://nodejs.org/api/http.html).

