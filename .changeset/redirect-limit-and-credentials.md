---
'@whatwg-node/node-fetch': patch
'@whatwg-node/fetch': patch
---

Follow the Fetch standard when the Node HTTP transport follows redirects.

`fetchNodeHttp` recursed on every 3xx `Location` while `redirect` was `'follow'` (the default) and never counted hops. A response that always redirects could keep one `fetch` call issuing requests until the process ran out of memory. Following now stops after 20 redirects. The promise rejects with `TypeError: Fetch failed: Maximum number of redirects (20) reached` and `code` `TooManyRedirects`. A chain of 20 redirects that then returns a normal response still completes.

That path also reused the previous request's `Headers` object for the next hop. A cross-origin `Location` therefore received `Authorization`, `Proxy-Authorization`, `Cookie`, `Cookie2`, and an explicit `Host`. Those headers are removed when the origin changes. The scheme is part of the origin, so an `https` to `http` redirect drops them too. Same-origin redirects still send them. Removal happens on a new header list, so the caller's own `Headers` object is left unchanged.

`301` and `302` responses to `POST`, and `303` responses to any method other than `GET` or `HEAD`, are resent as `GET` with no body. The request-body headers go with the body: `Content-Encoding`, `Content-Language`, `Content-Location`, `Content-Type`, and `Content-Length`. `307` and `308` keep the method and body when that body can be sent again. A one-shot stream cannot, and that redirect rejects.

`redirect: 'manual'` and `redirect: 'error'` behave as before. `@whatwg-node/fetch` uses this transport on Node, so the same limits apply there.
