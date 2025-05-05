---
'@whatwg-node/server': patch
---

Call response.end without waiting for `.write` because some implementations do not have callback in
`response.write`

Some implementations like `compression` npm package do not implement `response.write(data, callback)` signature, but whatwg-node/server waits for it to finish the response stream.
It is actually a bug in `compression` package;
https://github.com/expressjs/compression/blob/master/index.js#L99
But since it is a common mistake, we prefer to workaround this on our end.