---
'@whatwg-node/node-fetch': patch
---

In case of iterator cancellation, ensure the response stream a.k.a. `IncomingMessage` is properly closed.

```ts
const response = await fetch('http://localhost:3000/stream');

for await (const chunk of response.body) {
  console.log('Received chunk:', chunk);
  if (chunk === 'stop') {
    console.log('Stopping stream');
    // In case of `break` which calls the `iterator.return()`, we need to ensure the stream is closed properly.
    break;
  }
}
```