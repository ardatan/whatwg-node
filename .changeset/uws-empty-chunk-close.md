---
'@whatwg-node/server': patch
---

Skip empty uWS `onData` chunks and still close the request body stream when a chunk is queued.

Final empty upload callbacks no longer allocate a zero-length Buffer. Closing uses `desiredSize != null` so readers still see end-of-stream after draining a queued chunk (`desiredSize === 0`).
