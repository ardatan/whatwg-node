import { createServer } from 'http';
import { createServerAdapter, Response } from '@whatwg-node/server';

const serverAdapter = createServerAdapter(() => Response.json({ message: `Hello, World!` }));

createServer(serverAdapter).listen(4000, () => {
  console.log('listening on 0.0.0.0:4000');
});
