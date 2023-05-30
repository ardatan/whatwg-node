import { createServer } from 'http';
import { AddressInfo, Socket } from 'net';
// eslint-disable-next-line camelcase
import {
  App,
  us_listen_socket,
  us_listen_socket_close,
  us_socket_local_port,
} from 'uWebSockets.js';

export interface TestServer {
  name: string;
  url: string;
  addOnceHandler(handler: any): void;
  close(): Promise<void> | void;
}

export function createUWSTestServer(): Promise<TestServer> {
  const app = App();
  let listenSocket: us_listen_socket;
  let handler: any;
  return new Promise((resolve, reject) => {
    app
      .any('/*', (...args) => {
        const res = handler(...args);
        handler = undefined;
        return res;
      })
      .listen(0, newListenSocket => {
        listenSocket = newListenSocket;
        if (listenSocket) {
          // eslint-disable-next-line camelcase
          const port = us_socket_local_port(listenSocket);
          resolve({
            name: 'uWebSockets.js',
            url: `http://localhost:${port}/`,
            close() {
              // eslint-disable-next-line camelcase
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
  });
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
