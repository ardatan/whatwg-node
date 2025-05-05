---
'@whatwg-node/server': patch
---

Call response.end without waiting for `.write` because some implementations do not have callback in
`response.write`
