---
'@whatwg-node/node-fetch': patch
---

Fulfill pending `reader.read()` as `{ done: true }` when `cancel(reason)` runs, matching the WHATWG ReadableStream cancel algorithm (and native undici).

Previously `cancel()` called `readable.destroy()` without ending the stream first, so an in-flight `read()` rejected with `ERR_STREAM_PREMATURE_CLOSE` / `Premature close` instead of settling as done. The cancel `reason` still reaches `underlyingSource.cancel(reason)`.
