import React from 'react';
import fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { ReadableStream, Response, TextEncoder, URL } from '@whatwg-node/fetch';
import { createServerAdapter } from '../src/createServerAdapter.js';
import { ServerAdapter, ServerAdapterBaseObject } from '../src/types.js';

interface FastifyServerContext {
  req: FastifyRequest;
  reply: FastifyReply;
}

describe('Fastify', () => {
  if (process.env.LEAK_TEST) {
    it('noop', () => {});
    return;
  }
  let serverAdapter: ServerAdapter<
    FastifyServerContext,
    ServerAdapterBaseObject<FastifyServerContext>
  >;
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
  afterAll(async () => {
    await fastifyServer.close();
  });
  it('should handle streams', async () => {
    let cnt = 0;
    const encoder = new TextEncoder();
    serverAdapter = createServerAdapter<FastifyServerContext>(
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
  it('should handle headers and status', async () => {
    const headers = { 'x-custom-header': '55', 'x-cache-header': 'true' };
    const status = 300;

    const serverAdapter = createServerAdapter(request => {
      const url = new URL(request.url);
      const searchParamsObj = Object.fromEntries(url.searchParams);
      return Response.json(searchParamsObj, { headers, status });
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
      url: '/mypath',
    });
    expect(res.headers).toMatchObject(headers);
    expect(res.statusCode).toBe(status);
  });

  it('Should handle react streaming response', async () => {
    const serverAdapter = createServerAdapter(async () => {
      const MyComponent = () => {
        return React.createElement('h1', null, 'Rendered in React');
      };

      // @ts-expect-error React types not available yet
      const { renderToReadableStream } = await import('react-dom/server.edge');

      const stream = await renderToReadableStream(React.createElement(MyComponent));

      return stream;
    });

    const fastifyServer = fastify();
    fastifyServer.route({
      url: '/renderReact',
      method: ['GET'],
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
      url: '/renderReact',
    });
    const body = res.body;
    expect(body).toEqual('<h1>Rendered in React</h1>');
  });
});
