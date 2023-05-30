import { createServer } from 'http';
import { AddressInfo, Socket } from 'net';
import { App, us_listen_socket, us_listen_socket_close } from 'uWebSockets.js';

export interface TestServer {
  name: string;
  url: string;
  addOnceHandler(handler: any): void;
  close(): Promise<void> | void;
}

async function getPortFree() {
  return new Promise<number>(resolve => {
    const srv = createServer();
    srv.listen(0, () => {
      const port = (srv.address() as AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

export function createUWSTestServer(): Promise<TestServer> {
  const app = App();
  let listenSocket: us_listen_socket;
  let handler: any;
  return getPortFree().then(
    port =>
      new Promise((resolve, reject) => {
        app
          .any('/*', (...args) =>
            handler(...args).then((res: any) => {
              handler = undefined;
              return res;
            }),
          )
          .listen(port, newListenSocket => {
            listenSocket = newListenSocket;
            if (listenSocket) {
              resolve({
                name: 'uWebSockets.js',
                url: `http://localhost:${port}/`,
                close() {
                  us_listen_socket_close(listenSocket);
                },
                addOnceHandler(newHandler) {
                  handler = newHandler;
                },
              });
              return;
            }
            reject('Failed to start the server');
          });
      }),
  );
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
          return new Promise<any>(done => {
            server.close(done);
          });
        },
      });
    });
  });
}
