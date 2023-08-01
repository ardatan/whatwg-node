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

// @ts-ignore Type 'ServerAdapter<{}, ServerAdapterBaseObject<{}, (req: Request) => Promise<Response>>>' is not assignable to type 'RequestListener<typeof IncomingMessage, typeof ServerResponse>'.
// Types of parameters 'req' and 'req' are incompatible.
// Type 'IncomingMessage' is not assignable to type 'NodeRequest' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
//   Types of property 'url' are incompatible.
//     Type 'string | undefined' is not assignable to type 'string'.
//       Type 'undefined' is not assignable to type 'string'.
createServer(serverAdapter).listen(4000, () => {
  console.log('listening on 0.0.0.0:4000');
});
