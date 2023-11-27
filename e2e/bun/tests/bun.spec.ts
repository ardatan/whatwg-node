import { createServer } from 'node:http';
import { describe, expect, it } from 'bun:test';
import { assertDeployedEndpoint } from '../../shared-scripts/src/index';
import { createTestServerAdapter } from '../../shared-server/src/index';

describe('Bun', () => {
  it('works', async () => {
    const server = Bun.serve({
      fetch: createTestServerAdapter(),
      port: 3000,
    });
    try {
      await assertDeployedEndpoint(`http://localhost:3000/graphql`);
    } catch (e) {
      expect(e).toBeUndefined();
    }
    server.stop(true);
  });
  it('works with Node compat mode', async () => {
    const server = createServer(createTestServerAdapter());
    await new Promise<void>(resolve => server.listen(3000, resolve));
    try {
      await assertDeployedEndpoint(`http://localhost:3000/graphql`);
    } catch (e) {
      expect(e).toBeUndefined();
    }
    return new Promise(resolve => server.close(resolve));
  });
});
