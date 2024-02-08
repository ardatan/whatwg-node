import { assertDeployedEndpoint } from '@e2e/shared-scripts';
import { createTestServerAdapter } from '@e2e/shared-server';

const abortCtrl = new AbortController();
const url = await new Promise(resolve => {
  Deno.serve({
    handler: createTestServerAdapter(),
    onListen({ hostname, port }) {
      resolve(`http://${hostname}:${port}`);
    },
    signal: abortCtrl.signal,
  });
});

try {
  await assertDeployedEndpoint(url);
  Deno.exit(0);
} catch (e) {
  console.error(e);
  Deno.exit(1);
}
