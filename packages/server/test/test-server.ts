import { createServer, globalAgent, Server, ServerResponse } from 'node:http';
import { AddressInfo, Socket } from 'node:net';
import { Readable } from 'node:stream';
import express from 'express';
import fastify, { FastifyReply, FastifyRequest } from 'fastify';
import Koa, { Context } from 'koa';
import Hapi from '@hapi/hapi';
import { afterAll, beforeAll, describe } from '@jest/globals';
import { DisposableSymbols, patchSymbols } from '@whatwg-node/disposablestack';
import { ServerAdapter, ServerAdapterBaseObject } from '@whatwg-node/server';

export interface TestServer extends AsyncDisposable {
  name: string;
  url: string;
  addOnceHandler(handler: any, ...ctxParts: any[]): Promise<void> | void;
}

patchSymbols();

export async function createUWSTestServer(): Promise<TestServer> {
  const uwsUtils = createUWS();
  await uwsUtils.start();
  let handler: any;
  return {
    name: 'uWebSockets.js',
    url: `http://localhost:${uwsUtils.port}/`,
    async [DisposableSymbols.asyncDispose]() {
      await handler?.[DisposableSymbols.asyncDispose]?.();
      return uwsUtils.stop();
    },
    async addOnceHandler(newHandler, ...ctxParts) {
      await handler?.[DisposableSymbols.asyncDispose]?.();
      handler = newHandler;
      if (ctxParts.length) {
        handler = function (...args: any[]) {
          return newHandler(...args, ...ctxParts);
        };
      }
      return uwsUtils.addOnceHandler(handler, ...ctxParts);
    },
  };
}

export async function createBunServer(): Promise<TestServer> {
  let handler: any;
  const server = Bun.serve({
    port: 0,
    fetch(...args: any[]) {
      return handler(...args);
    },
  });
  return {
    name: 'Bun',
    url: server.url.toString(),
    async [DisposableSymbols.asyncDispose]() {
      await handler?.[DisposableSymbols.asyncDispose]?.();
      return server.stop(true);
    },
    async addOnceHandler(newHandler, ...ctxParts) {
      await handler?.[DisposableSymbols.asyncDispose]?.();
      handler = newHandler;
      if (ctxParts.length) {
        handler = function (...args: any[]) {
          return newHandler(...args, ...ctxParts);
        };
      }
    },
  };
}

export function createNodeHttpTestServer(): Promise<TestServer> {
  let handler: any;
  const server = createServer(function handlerWrapper(req, res) {
    return handler(req, res);
  });
  const connections = new Set<Socket>();
  server.on('connection', socket => {
    connections.add(socket);
    socket.once('close', () => {
      connections.delete(socket);
    });
  });
  return new Promise(resolve => {
    server.listen(0, () => {
      const addressInfo = server.address() as AddressInfo;
      const url = `http://localhost:${addressInfo.port}/`;
      resolve({
        name: 'Node.js http',
        url,
        async addOnceHandler(newHandler, ...ctxParts) {
          await handler?.[DisposableSymbols.asyncDispose]?.();
          handler = newHandler;
          if (ctxParts.length) {
            handler = function (...args: any[]) {
              return newHandler(...args, ...ctxParts);
            };
          }
        },
        [DisposableSymbols.asyncDispose]() {
          connections.forEach(socket => {
            socket.destroy();
          });
          if (!globalThis.Bun) {
            server.closeAllConnections();
          }
          return new Promise<void>((resolve, reject) => {
            server.close(err => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
        },
      });
    });
  });
}

export const serverImplMap: Record<string, () => Promise<TestServer>> = {};

if ((globalThis as any)['createUWS']) {
  serverImplMap.uWebSockets = createUWSTestServer;
}

serverImplMap['node:http'] = createNodeHttpTestServer;

serverImplMap['express'] = async function createExpressTestServer() {
  let handler: any;
  const app = express().use((...args) => handler(...args));
  const sockets = new Set<Socket>();
  let server: Server | undefined;
  await new Promise<void>((resolve, reject) => {
    server = app
      .listen(0, () => {
        resolve();
      })
      .once('error', reject)
      .on('connection', socket => {
        sockets.add(socket);
        socket.once('close', () => {
          sockets.delete(socket);
        });
      });
  });

  return {
    name: 'express',
    url: `http://localhost:${(server?.address() as AddressInfo).port}`,
    async [DisposableSymbols.asyncDispose]() {
      await handler?.[DisposableSymbols.asyncDispose]?.();
      sockets.forEach(socket => {
        socket.destroy();
      });
      return new Promise((resolve, reject) => {
        if (server) {
          server.close(err => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    },
    async addOnceHandler(newHandler, ...ctxParts) {
      await handler?.[DisposableSymbols.asyncDispose]?.();
      handler = newHandler;
      if (ctxParts.length) {
        handler = function (...args: any[]) {
          return newHandler(...args, ...ctxParts);
        };
      }
    },
  };
};
serverImplMap['fastify'] = async function createFastifyTestServer() {
  let adapter: ServerAdapter<
    {
      req: FastifyRequest;
      res: ServerResponse;
      reply: FastifyReply;
    },
    ServerAdapterBaseObject<{}>
  >;

  const fastifyApp = fastify().route({
    method: ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT', 'OPTIONS', 'TRACE'],
    url: '*',
    async handler(req: FastifyRequest, reply: FastifyReply) {
      const response: Response = await adapter.handleNodeRequestAndResponse(req, reply, {
        req,
        res: reply.raw,
        reply,
      });

      if (!response) {
        return reply.status(404).send('Not Found');
      }

      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      reply.status(response.status);

      reply.send(response.body || '');

      return reply;
    },
  });
  const sockets = new Set<Socket>();
  fastifyApp.server.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => {
      sockets.delete(socket);
    });
  });

  fastifyApp.addContentTypeParser(/(.*)/, {}, (_req, _payload, done) => done(null));

  let url = await fastifyApp.listen({ port: 0, host: '::1' });
  url = url.replace('127.0.0.1', 'localhost');
  return {
    name: 'fastify',
    url,
    async [DisposableSymbols.asyncDispose]() {
      await adapter?.[DisposableSymbols.asyncDispose]?.();
      sockets.forEach(socket => {
        socket.destroy();
      });
      if (!globalThis.Bun) {
        fastifyApp.server.closeAllConnections();
      }
      await new Promise<void>((resolve, reject) => {
        fastifyApp.server.close(err => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      return fastifyApp.close();
    },
    async addOnceHandler(newHandler, ...ctxParts) {
      await adapter?.[DisposableSymbols.asyncDispose]?.();
      adapter = newHandler;
      if (ctxParts.length) {
        adapter = {
          ...newHandler,
          handleNodeRequestAndResponse(...args: any[]) {
            return newHandler.handleNodeRequestAndResponse(...args, ...ctxParts);
          },
        };
      }
    },
  };
};

if (globalThis.Bun) {
  serverImplMap.Bun = createBunServer;
} else if (globalThis.Deno) {
  serverImplMap.Deno = async function createDenoTestServer() {
    let handler: any;

    const server = Deno.serve(
      {
        hostname: '::',
      },
      (...args) => handler(...args),
    );
    return {
      name: 'Deno',
      url: `http://localhost:${server.addr.port}`,
      async [DisposableSymbols.asyncDispose]() {
        await handler?.[DisposableSymbols.asyncDispose]?.();
        return server.shutdown();
      },
      async addOnceHandler(newHandler, ...ctxParts) {
        await handler?.[DisposableSymbols.asyncDispose]?.();
        handler = newHandler;
        if (ctxParts.length) {
          handler = function (...args: any[]) {
            return newHandler(...args, ...ctxParts);
          };
        }
      },
    };
  };
} else {
  serverImplMap['koa'] = async function createKoaTestServer() {
    let adapter: ServerAdapter<Context, ServerAdapterBaseObject<{}>>;
    const app = new Koa();
    app.use(async ctx => {
      try {
        const response: Response = await adapter.handleNodeRequestAndResponse(
          ctx.request,
          ctx.res,
          ctx,
        );

        if (!response) {
          ctx.status = 404;
          ctx.body = 'Not Found';
          return;
        }
        // Set status code
        ctx.status = response.status;

        // Set headers
        response.headers.forEach((value, key) => {
          ctx.append(key, value);
        });

        ctx.body =
          response.body instanceof globalThis.ReadableStream
            ? Readable.fromWeb(response.body as any)
            : response.body || '';
      } catch (err: any) {
        ctx.status = 500;
        ctx.body = err.message;
      }
    });

    let server: Server | undefined;
    const sockets = new Set<Socket>();
    await new Promise<void>((resolve, reject) => {
      server = app
        .listen(0, resolve)
        .once('error', reject)
        .on('connection', socket => {
          sockets.add(socket);
          socket.once('close', () => {
            sockets.delete(socket);
          });
        });
    });

    return {
      name: 'koa',
      get url() {
        return `http://localhost:${(server?.address() as AddressInfo).port}`;
      },
      [DisposableSymbols.asyncDispose]() {
        for (const socket of sockets) {
          socket.destroy();
        }
        if (!globalThis.Bun) {
          server?.closeAllConnections();
        }
        return new Promise<void>((resolve, reject) => {
          if (server) {
            server.close(err => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          } else {
            resolve();
          }
        });
      },
      async addOnceHandler(newHandler, ...ctxParts) {
        await adapter?.[DisposableSymbols.asyncDispose]?.();
        adapter = newHandler;
        if (ctxParts.length) {
          adapter = {
            ...newHandler,
            handleNodeRequestAndResponse(...args: any[]) {
              return newHandler.handleNodeRequestAndResponse(...args, ...ctxParts);
            },
          };
        }
      },
    };
  };
  serverImplMap['hapi'] = async function createKoaTestServer() {
    interface HapiContext {
      req: Hapi.Request;
      res: ServerResponse;
      h: Hapi.ResponseToolkit;
    }
    let adapter: ServerAdapter<HapiContext, ServerAdapterBaseObject<{}>>;
    const server = Hapi.server({ port: 0 });

    server.route({
      method: '*',
      path: '/{any*}',
      options: {
        payload: {
          // allow everything
          parse: false,
          // let adapter handle the parsing
          output: 'stream',
        },
      },
      handler: async (req, h) => {
        try {
          const response = await adapter.handleNodeRequestAndResponse(req.raw.req, req.raw.res, {
            req,
            res: req.raw.res,
            h,
          });

          if (req.raw.res.headersSent) {
            return h.abandon;
          }

          if (!response) {
            return h.response('Not Found').code(404);
          }

          // Hapi stream should not be in object mode
          let body: Readable | undefined;
          if (response.body instanceof globalThis.ReadableStream) {
            // @ts-expect-error - Types are wrong
            body = Readable.fromWeb(response.body, {
              objectMode: false,
            });
          } else if (response.body) {
            body = Readable.from(response.body, {
              objectMode: false,
              emitClose: true,
              autoDestroy: true,
            });
          }
          const res = h.response(body);

          response.headers.forEach((value, key) => {
            res.header(key, value);
          });

          return res.code(response.status);
        } catch (e: any) {
          return h.response(e.message).code(500);
        }
      },
    });
    await server.start();
    const sockets = new Set<Socket>();
    server.listener.on('connection', socket => {
      sockets.add(socket);
      socket.once('close', () => {
        sockets.delete(socket);
      });
    });
    return {
      name: 'hapi',
      get url() {
        return `http://localhost:${(server.listener.address() as AddressInfo).port}`;
      },
      [DisposableSymbols.asyncDispose]() {
        for (const socket of sockets) {
          socket.destroy();
        }
        if (!globalThis.Bun) {
          server.listener.closeAllConnections();
        }
        return server.stop();
      },
      async addOnceHandler(newHandler, ...ctxParts) {
        await adapter?.[DisposableSymbols.asyncDispose]?.();
        adapter = newHandler;
        if (ctxParts.length) {
          adapter = {
            ...newHandler,
            handleNodeRequestAndResponse(...args: any[]) {
              return newHandler.handleNodeRequestAndResponse(...args, ...ctxParts);
            },
          };
        }
      },
    };
  };
}

const globalServerMap: Record<string, TestServer> = {};

async function ensureTestImpl(serverImplName: string) {
  globalServerMap[serverImplName] ||= await serverImplMap[serverImplName]();
}

afterAll(async () => {
  const jobs = new Set<PromiseLike<void>>();
  for (const serverImplName in globalServerMap) {
    const job = globalServerMap[serverImplName][DisposableSymbols.asyncDispose]();
    if (job?.then != null) {
      jobs.add(
        job.then(() => {
          delete globalServerMap[serverImplName];
          jobs.delete(job);
        }),
      );
    }
  }
  await Promise.all(jobs);
  globalAgent.destroy();
});

export function runTestsForEachServerImpl(
  callback: (server: TestServer, serverImplName: string) => void,
) {
  for (const serverImplName in serverImplMap) {
    describe(serverImplName, () => {
      beforeAll(() => ensureTestImpl(serverImplName));
      callback(
        {
          get name() {
            return serverImplName;
          },
          get url() {
            return globalServerMap[serverImplName].url;
          },
          addOnceHandler: (handler, ...ctxParts) =>
            globalServerMap[serverImplName].addOnceHandler(handler, ...ctxParts),
          [DisposableSymbols.asyncDispose]: () =>
            globalServerMap[serverImplName][DisposableSymbols.asyncDispose](),
        },
        serverImplName,
      );
    });
  }
}
