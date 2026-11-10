---
'@whatwg-node/server': patch
---

Skip empty uWS `onData` chunks and close request body streams safely when a chunk is queued or canceled.

Final empty upload callbacks no longer allocate a zero-length Buffer. Closing uses `desiredSize != null` so readers still see end-of-stream after draining a queued chunk (`desiredSize === 0`). Canceling a body stream removes its push/stop callbacks so a later final `onData` cannot `close()` a canceled controller and leave clones hung.
