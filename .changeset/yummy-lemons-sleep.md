---
'@whatwg-node/server': patch
---

If the incoming request is not parsed/consumed before the response is sent, the request stream should be closed to prevent memory leaks.
