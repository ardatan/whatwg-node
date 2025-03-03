---
'@whatwg-node/promise-helpers': minor
---

Fix return type of the callback of `iterateAsync`. The callback can actually return `null` or
`undefined`, the implementation is already handling this case.
