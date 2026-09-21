---
'@whatwg-node/server': patch
---

Discard unread Node/uWS request bodies when responding (e.g. early `endResponse`), so keep-alive connections are not stalled and large rejected uploads are not buffered for the lifetime of the response.
