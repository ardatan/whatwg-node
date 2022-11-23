import { createVercelDeployment } from './createVercelDeployment';
import { runTests } from '@e2e/shared-scripts';

runTests(createVercelDeployment()).catch(err => {
  console.error(err);
  process.exit(1);
});
