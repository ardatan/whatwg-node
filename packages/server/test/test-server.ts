import { createServer, Server } from 'http';
import { AddressInfo } from 'net';

export interface TestServer {
  url: string;
  server: Server;
}

export function createTestServer(): Promise<TestServer> {
  const server = createServer();
  return new Promise(resolve => {
    server.listen(0, () => {
      const addressInfo = server.address() as AddressInfo;
      const url = `http://localhost:${addressInfo.port}/`;
      resolve({ server, url });
    });
  });
}
