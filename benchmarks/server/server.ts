import { createServer } from 'http';
import { createServerAdapter } from '@whatwg-node/server';

const serverAdapter = createServerAdapter(() => Response.json({ message: `Hello, World!` }), {
  fetchAPI: {
    fetch,
    Request,
    Response,
    Headers,
    FormData,
    ReadableStream,
    WritableStream,
    TransformStream,
    URLPattern,
    URL,
    URLSearchParams,
  },
});

createServer(serverAdapter).listen(4000, () => {
  console.log('listening on 0.0.0.0:4000');
});
