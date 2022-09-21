import { createServer, RequestListener, Server } from 'http';
import { AddressInfo, Socket } from 'net';

const serverLeftovers: (() => Promise<void>)[] = [];
afterAll(async () => {
  while (serverLeftovers.length > 0) {
    await serverLeftovers.pop()?.();
  }
});

/**
 * Starts a disposable Node test server that destroys connected sockets on dispose and then stops.
 *
 * In case you forgot to dispose yourself, the server will be auto-disposed after all tests complete.
 */
export function startTServer(listener?: RequestListener): {
  server: Server;
  url: string;
  dispose: () => Promise<void>;
} {
  const server = createServer(listener);

  const sockets = new Set<Socket>();
  server.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });

  const dispose = async () => {
    for (const socket of sockets) {
      socket.destroy();
    }
    await new Promise<void>(resolve => server.close(() => resolve()));
  };
  serverLeftovers.push(dispose);

  server.listen(0);

  const { port } = server.address() as AddressInfo;
  const url = `http://localhost:${port}`;

  return { server, url, dispose };
}
