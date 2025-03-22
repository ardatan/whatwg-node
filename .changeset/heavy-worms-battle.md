---
'@whatwg-node/node-fetch': patch
---

When any `Request` method is called outside server adapter scope, it used to hang.
This PR prevents it to hang and throw an error if the readable stream is destroyed earlier.

```ts
let request: Request;
const adapter = createServerAdapter(req => {
    request = req;
  return new Response('Hello World');
});

await request.text(); // Was hanging but now throws an error
```