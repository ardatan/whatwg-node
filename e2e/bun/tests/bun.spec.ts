import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'bun:test';
import { createServerAdapter } from '@whatwg-node/server';
import { assertDeployedEndpoint } from '../../shared-scripts/src/index';
import { createTestServerAdapter } from '../../shared-server/src/index';

describe('Bun', () => {
  let stopServer: () => void;
  afterEach(() => stopServer?.());
  it('works', async () => {
    const server = Bun.serve({
      fetch: createTestServerAdapter(),
      port: 3000,
    });
    stopServer = () => server.stop(true);
    try {
      await assertDeployedEndpoint(`http://localhost:3000/graphql`);
    } catch (e) {
      expect(e).toBeUndefined();
    }
  });
  it('should have unique contexts for each request', async () => {
    const contexts = new Set();
    const adapter = createServerAdapter((_, ctx) => {
      contexts.add(ctx);
      return new Response(null, {
        status: 204,
      });
    });
    const server = Bun.serve({
      fetch: adapter,
      port: 3000,
    });
    stopServer = () => server.stop(true);
    for (let i = 0; i < 10; i++) {
      await fetch(`http://localhost:3000/graphql`);
    }
    expect(contexts.size).toBe(10);
  });
  it('works with Node compat mode', async () => {
    const server = createServer(createTestServerAdapter());
    stopServer = () => server.close();
    await new Promise<void>(resolve => server.listen(3000, resolve));
    try {
      await assertDeployedEndpoint(`http://localhost:3000/graphql`);
    } catch (e) {
      expect(e).toBeUndefined();
    }
  });
});
