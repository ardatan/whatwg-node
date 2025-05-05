---
'@whatwg-node/server': patch
---

Some implementations like `compression` npm package do not implement `response.write(data, callback)` signature, but whatwg-node/server waits for it to finish the response stream.
Then it causes the response stream hangs when the compression package takes the stream over when the response data is larger than its threshold.

It is actually a bug in `compression` package;
https://github.com/expressjs/compression/blob/master/index.js#L99
But since it is a common mistake, we prefer to workaround this on our end.

So now the server adapter calls `response.end` immediately after `response.write` for static responses.