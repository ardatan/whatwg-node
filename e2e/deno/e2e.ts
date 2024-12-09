import { assertDeployedEndpoint } from '../shared-scripts/src/utils';
import { createTestServerAdapter } from '../shared-server/src/index';

const abortCtrl = new AbortController();
const url = await new Promise<string>(resolve => {
  Deno.serve(
    {
      onListen({ hostname, port }) {
        resolve(`http://${hostname}:${port}`);
      },
      signal: abortCtrl.signal,
    },
    createTestServerAdapter(),
  );
});

try {
  await assertDeployedEndpoint(url);
  Deno.exit(0);
} catch (e) {
  console.error(e);
  Deno.exit(1);
}
