import { createServer } from 'node:http';
import { Response } from '@whatwg-node/fetch';
import { createServerAdapter } from '@whatwg-node/server';

createServer(createServerAdapter(() => Response.json({ hello: 'world' }))).listen(3000, () => {
  console.log('Server is running at http://localhost:3000');
  console.log('Press Ctrl+C to stop the server.');
});
