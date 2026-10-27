---
'@whatwg-node/node-fetch': patch
---

Sort header names when iterating, per Fetch sort-and-combine. Repeated names stay
combined, and `set-cookie` values stay separate in sorted name order.
