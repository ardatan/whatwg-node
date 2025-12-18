---
'@whatwg-node/server': patch
---

Destroy the Node response when the WHATWG response body stream errors or is aborted, so the client socket is closed (RST / ECONNRESET) instead of hanging.
