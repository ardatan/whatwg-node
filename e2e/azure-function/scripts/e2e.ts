import { createAzureFunctionDeployment } from './createAzureFunctionDeployment';
import { runTests } from '@e2e/shared-scripts';

runTests(createAzureFunctionDeployment()).catch(err => {
  console.error(err);
  process.exit(1);
});
