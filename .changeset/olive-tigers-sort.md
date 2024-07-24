---
'@whatwg-node/server': patch
---

New plugin to handle E2E request compression

When the client provides `Accept-Encoding` header, if the server supports the encoding, it will compress the response body. This will reduce the size of the response body and improve the performance of the application. 

On the other hand, if the client sends `Content-Encoding` header, the server will decompress the request body before processing it. This will allow the server to handle the request body in its original form. 
If the server does not support the encoding, it will respond with `415 Unsupported Media Type` status code. 

`serverAdapter`'s `fetch` function handles the compression and decompression of the request and response bodies. 

```ts
import {createServerAdapter, useContentEncoding, Response} from '@whatwg-node/server';

const serverAdapter = createServerAdapter(() => Response.json({hello: 'world'}), {
    plugins: [useContentEncoding()],
});

```