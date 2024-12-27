---
'@whatwg-node/node-fetch': patch
---

- Normalization fixes on `URL`

Normalize the URL if it has a port and query string without a pathname;

```diff
+ http://example.com:80?query
- http://example.com:80/?query
```

Previously, it was normalized like below which was incorrect;

```diff
- http://example.com:80?query
+ http://example.com/:80?query
```

- Fix `URL.origin`

When the URL has a port, `origin` was doubling the port number;

```diff
- http://example.com:80:80
+ http://example.com:80
```

- Fix `ReadableStream[Symbol.asyncIterator]`

`ReadableStream` uses `Readable` so it uses `Symbol.asyncIterator` method of `Readable` but the returned iterator's `.return` method doesn't handle cancellation correctly. So we need to call `readable.destroy(optionalError)` manually to cancel the stream.

This allows `ReadableStream` to use implementations relying on `AsyncIterable.cancel` to handle cancellation like `Readable.from`

Previously the following was not handling cancellation;

```ts
const res = new ReadableStream({
  start(controller) {
    controller.enqueue('Hello');
    controller.enqueue('World');
  },
  cancel(reason) {
    console.log('cancelled', reason);
  }
});

const readable = Readable.from(res);

readable.destroy(new Error('MY REASON'));

// Should log 'cancelled MY REASON'
```
