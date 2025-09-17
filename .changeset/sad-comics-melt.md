---
'@whatwg-node/node-fetch': minor
---

Add `User-Agent` with `node` value by default similar to `undici`, because `fetch` implementation
should provide one if the user doesn't provide one per WHATWG spec
