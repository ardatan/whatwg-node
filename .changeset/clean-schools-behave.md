---
'@whatwg-node/node-fetch': patch
---

Fix the bug causing the stream hang when the response body is empty.
Related https://github.com/ardatan/whatwg-node/issues/703