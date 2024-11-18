/* eslint-disable camelcase */
import { createServer, globalAgent } from 'http';
import { AddressInfo, Socket } from 'net';
import { afterAll, beforeAll, describe } from '@jest/globals';

export interface TestServer {
  name: string;
  url: string;
  addOnceHandler(handler: any): void;
  close(): Promise<void> | void;
}

export async function createUWSTestServer(): Promise<TestServer> {
  const uwsUtils = createUWS();
  await uwsUtils.start();
  return {
    name: 'uWebSockets.js',
    url: `http://localhost:${uwsUtils.port}/`,
    close() {
      return uwsUtils.stop();
    },
    addOnceHandler(newHandler) {
      uwsUtils.addOnceHandler(newHandler);
    },
  };
}

export async function createBunServer(): Promise<TestServer> {
  let handler: any;
  const server = Bun.serve({
    port: 0,
    fetch(...args) {
      return handler(...args);
    },
  });
  return {
    name: 'Bun',
    url: server.url.toString(),
    close() {
      return server.stop();
    },
    addOnceHandler(newHandler) {
      handler = newHandler;
    },
  };
}

export function createNodeHttpTestServer(): Promise<TestServer> {
  const server = createServer();
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
        addOnceHandler(handler) {
          server.once('request', handler);
        },
        close() {
          connections.forEach(socket => {
            socket.destroy();
          });
          return new Promise<any>(resolve => {
            server.close(resolve);
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

export function runTestsForEachServerImpl(
  callback: (server: TestServer, serverImplName: string) => void,
) {
  for (const serverImplName in serverImplMap) {
    describe(serverImplName, () => {
      const server: TestServer = {} as TestServer;
      beforeAll(async () => {
        Object.assign(server, await serverImplMap[serverImplName as keyof typeof serverImplMap]());
      });
      afterAll(async () => {
        await server.close();
        globalAgent.destroy();
      });
      callback(server, serverImplName);
    });
  }
}
