---
'@whatwg-node/server': patch
---

Omit `Access-Control-Allow-Origin` when the request `Origin` is not in the allowlist, instead of sending the string `null`.

Returning `Access-Control-Allow-Origin: null` is discouraged (MDN / W3C CORS for developers): the browser should simply not see an ACAO header and enforce the Same-Origin Policy.

Browser coverage for this CORS behavior and for `@whatwg-node/server-plugin-cookies` is covered by Puppeteer tests (`npm run test:browser`).
