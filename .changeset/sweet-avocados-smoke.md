---
"@whatwg-node/server": patch
---

Do not call res.onAborted multiple times because it causes it to overwrite the previous listener, and use AbortSignal's abort event instead
