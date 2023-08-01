import fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { ReadableStream, Response, TextEncoder, URL } from '@whatwg-node/fetch';
import { createServerAdapter } from '../src/createServerAdapter.js';

describe('Fastify', () => {
  it('should handle streams', async () => {
    let cnt = 0;
    const encoder = new TextEncoder();
    const serverAdapter = createServerAdapter<{
      req: FastifyRequest;
      reply: FastifyReply;
    }>(
      () =>
        new Response(
          new ReadableStream({
            async pull(controller) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    cnt,
                  }) + '\n',
                ),
              );
              cnt++;
              await new Promise(resolve => setTimeout(resolve, 300));
              if (cnt > 3) {
                controller.close();
              }
            },
          }),
        ),
    );
    const fastifyServer = fastify();
    fastifyServer.route({
      url: '/mypath',
      method: ['GET', 'POST', 'OPTIONS'],
      handler: async (req, reply) => {
        const response = await serverAdapter.handleNodeRequest(req, {
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
    const res = await fastifyServer.inject({
      url: '/mypath',
    });
    expect(res.body).toMatchInlineSnapshot(`
      "{"cnt":0}
      {"cnt":1}
      {"cnt":2}
      {"cnt":3}
      "
    `);
  });
  it('should handle GET requests with query params', async () => {
    const serverAdapter = createServerAdapter(request => {
      const url = new URL(request.url);
      const searchParamsObj = Object.fromEntries(url.searchParams);
      return Response.json(searchParamsObj);
    });
    const fastifyServer = fastify();
    fastifyServer.route({
      url: '/mypath',
      method: ['GET', 'POST', 'OPTIONS'],
      handler: async (req, reply) => {
        const response = await serverAdapter.handleNodeRequest(req, {
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
    const res = await fastifyServer.inject({
      url: '/mypath?foo=bar&baz=qux',
    });
    const body = res.json();
    expect(body).toMatchObject({
      foo: 'bar',
      baz: 'qux',
    });
  });
});
