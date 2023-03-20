import { AddressInfo, Socket } from 'net';
import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fetch, ReadableStream, Response, TextEncoder, URL } from '@whatwg-node/fetch';
import { createServerAdapter } from '../src/createServerAdapter.js';

describe('Fastify', () => {
  let fastifyServer: FastifyInstance;
  const connections = new Set<Socket>();
  afterEach(() => {
    connections.forEach(socket => {
      socket.destroy();
    });
    return fastifyServer?.close();
  });
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
    fastifyServer = fastify();
    fastifyServer.server.on('connection', socket => {
      connections.add(socket);
      socket.on('close', () => {
        connections.delete(socket);
      });
    });
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
    await fastifyServer.listen({
      port: 0,
    });
    const res = await fetch(
      `http://localhost:${(fastifyServer.server.address() as AddressInfo).port}/mypath`,
    );
    const body = await res.text();
    expect(body).toMatchInlineSnapshot(`
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
    fastifyServer = fastify();
    fastifyServer.server.on('connection', socket => {
      connections.add(socket);
      socket.on('close', () => {
        connections.delete(socket);
      });
    });
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
    await fastifyServer.listen({
      port: 0,
    });
    const res = await fetch(
      `http://localhost:${
        (fastifyServer.server.address() as AddressInfo).port
      }/mypath?foo=bar&baz=qux`,
    );
    const body = await res.json();
    expect(body).toMatchObject({
      foo: 'bar',
      baz: 'qux',
    });
  });
});
