---
'@whatwg-node/server': patch
---

Remove SIGTERM from termination events to prevent hangs, and always add disposable stack to the termination events

