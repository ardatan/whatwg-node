---
'@whatwg-node/node-fetch': patch
'@whatwg-node/fetch': patch
'@whatwg-node/server': patch
---

Some implementations like `compression` npm package do not implement `response.write(data, callback)` signature, but whatwg-node/server waits for it to finish the response stream.
Then it causes the response stream hangs when the compression package takes the stream over when the response data is larger than its threshold.

It is actually a bug in `compression` package;
[expressjs/compression#46](https://github.com/expressjs/compression/issues/46)
But since it is a common mistake, we prefer to workaround this on our end.

Now after calling `response.write`, it no longer uses callback but first it checks the result;

if it is `true`, it means stream is drained and we can call `response.end` immediately.
else if it is `false`, it means the stream is not drained yet, so we can wait for the `drain` event to call `response.end`.
