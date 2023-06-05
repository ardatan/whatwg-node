import { createServer } from 'http';
import { createServerAdapter, Response } from '@whatwg-node/server';

const serverAdapter = createServerAdapter(async req => {
  let name = 'World';
  if (req.method === 'POST') {
    const { name: bodyName } = await req.json();
    if (bodyName) {
      name = bodyName;
    }
  }
  return Response.json({ message: `Hello, ${name}!` });
});

createServer(serverAdapter).listen(4000, () => {
  console.log('listening on 0.0.0.0:4000');
});
