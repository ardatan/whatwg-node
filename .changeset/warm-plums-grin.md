---
'@whatwg-node/node-fetch': patch
---

- Remove URL ponyfill implementation based on `fast-url-parser` and `fast-querystring`, because Node now uses Ada URL parser which is fast enough.

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
