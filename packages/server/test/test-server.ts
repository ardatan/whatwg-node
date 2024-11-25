/* eslint-disable camelcase */
import { createServer, globalAgent } from 'http';
import { AddressInfo, Socket } from 'net';
import { afterAll, beforeAll, describe } from '@jest/globals';
import { DisposableSymbols } from '@whatwg-node/disposablestack';

export interface TestServer extends AsyncDisposable {
  name: string;
  url: string;
  addOnceHandler(handler: any): Promise<void> | void;
}

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
    async addOnceHandler(newHandler) {
      await handler?.[DisposableSymbols.asyncDispose]?.();
      handler = newHandler;
      uwsUtils.addOnceHandler(newHandler);
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
    async addOnceHandler(newHandler) {
      await handler?.[DisposableSymbols.asyncDispose]?.();
      handler = newHandler;
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
        async addOnceHandler(newHandler) {
          await handler?.[DisposableSymbols.asyncDispose]?.();
          handler = newHandler;
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

if (globalThis.Bun) {
  serverImplMap.Bun = createBunServer;
} else {
  serverImplMap['node:http'] = createNodeHttpTestServer;
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
            return globalServerMap[serverImplName].name;
          },
          get url() {
            return globalServerMap[serverImplName].url;
          },
          addOnceHandler: handler => globalServerMap[serverImplName].addOnceHandler(handler),
          [DisposableSymbols.asyncDispose]: () =>
            globalServerMap[serverImplName][DisposableSymbols.asyncDispose](),
        },
        serverImplName,
      );
    });
  }
}
