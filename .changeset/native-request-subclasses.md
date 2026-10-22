---
'@whatwg-node/server': patch
---

Pick the native Fetch API for `Request` subclasses and proxies of them, such as Next.js `NextRequest`.

Constructor identity treated those requests as the ponyfill, so `useLimitRequestBodySize` piped a native body through `PonyfillTransformStream` and Node threw `The "transform.readable" property must be an instance of ReadableStream`.
