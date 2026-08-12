---
'@whatwg-node/server': patch
---

Trim values when parsing `Accept-Encoding` / `Content-Encoding` header lists.

Native HTTPS clients (e.g. undici) send values like `br, gzip, deflate`; without trimming, encodings after the first comma never matched and response compression was skipped.
