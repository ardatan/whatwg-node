---
'@whatwg-node/node-fetch': patch
---

Avoid intermediate arrays in `PonyfillHeaders` hot-path reads.

Array-backed `get()` no longer uses `filter`/`map`, and `keys`/`values`/`entries` iterate with `for…of` instead of building throwaway arrays just to yield them. This lowers allocation when headers are inspected or forwarded without materializing the internal map.
