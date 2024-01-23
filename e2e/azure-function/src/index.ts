import { app, InvocationContext } from '@azure/functions';
import { createTestServerAdapter } from '@e2e/shared-server';

const handler = createTestServerAdapter<InvocationContext>();

declare global {
  interface ReadableStream {
    [Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array>;
  }
}

app.http('whatwgnode', {
  methods: ['GET', 'POST'],
  handler,
});
