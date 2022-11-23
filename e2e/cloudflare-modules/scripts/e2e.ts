import { createCfDeployment } from '../../cloudflare-workers/scripts/createCfDeployment';
import { runTests } from '@e2e/shared-scripts';

runTests(createCfDeployment('cloudflare-modules', true)).catch(err => {
  console.error(err);
  process.exit(1);
});
