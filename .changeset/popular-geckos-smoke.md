---
'@whatwg-node/server': patch
---

While using `useContentEncoding`, if compression is applied in both ends, respect `Accept-Encoding`
from the client correctly
