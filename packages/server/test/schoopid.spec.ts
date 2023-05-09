import { Socket } from 'net';
import * as fetchAPI from '@whatwg-node/fetch';
import { createServerAdapter } from '@whatwg-node/server';
import { createTestServer, TestServer } from './test-server.js';

let testServer: TestServer;
const connections = new Set<Socket>();
beforeAll(async () => {
  testServer = await createTestServer();
  testServer.server.on('connection', socket => {
    connections.add(socket);
    socket.once('close', () => {
      connections.delete(socket);
    });
  });
});
afterAll(done => {
  connections.forEach(socket => {
    socket.destroy();
  });
  testServer.server.close(done);
});

const iterations = 300;

describe('leakage', () => {
  for (let i = 0; i < iterations; i++) {
    it('should not leak', async () => {
      const adapter = createServerAdapter(async () => {
        return new fetchAPI.Response();
      });
      testServer.server.once('request', adapter);

      // with native fetch, leaks on 300 iterations
      // await fetch(
      await fetchAPI.fetch(
        testServer.url,
        // without request init, leaks on 200 iterations
        // with request init, leaks on 100 iterations
        // {
        //   method: 'GET',
        //   headers: {
        //     accept: 'application/json',
        //   },
        // },
      );
    });
  }
});
