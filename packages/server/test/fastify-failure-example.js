import fastify from 'fastify';
import { createServerAdapter } from '@whatwg-node/server';

const run = async () => {
  const myServerAdapter = createServerAdapter(() => {
    return new Response('Hello World');
  });

  const app = fastify({
    logger: true,
  });

  app.route({
    url: '/mypath',
    method: ['GET', 'POST', 'OPTIONS'],
    handler: async (req, reply) => {
      const response = await myServerAdapter.handleNodeRequest(req, {
        req,
        reply,
      });
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      reply.status(response.status);

      reply.send(response.body);

      return reply;
    },
  });

  console.log('Starting server...');
  await app.listen({
    port: 3000,
  });
  console.log('Server started.');

  console.log('Sending request...');
  const response = await fetch('http://localhost:3000/mypath');
  console.log('Request sent.');

  console.log('Response status:', response.status);

  await app.close();
};

run();
