import { createCfDeployment } from './createCfDeployment';
import { runTests } from '@e2e/shared-scripts';

runTests(createCfDeployment('cloudflare-workers')).catch(err => {
  console.error(err);
  process.exit(1);
});
