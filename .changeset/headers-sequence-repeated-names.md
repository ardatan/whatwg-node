---
'@whatwg-node/node-fetch': patch
---

Keep every value of a header name that is repeated in a sequence passed to `Headers`.

Changing, adding or deleting another header kept only the last value of the name, `set()` replaced
only the first value, and iteration returned the pairs as given instead of one combined entry with
a lowercase name. A server response built with `[["link", "<a>"], ["link", "<b>"]]` was sent with
`link: <b>` only.
