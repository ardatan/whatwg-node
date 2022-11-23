import { createAwsLambdaDeployment } from './createAwsLambdaDeployment';
import { runTests } from '@e2e/shared-scripts';

runTests(createAwsLambdaDeployment()).catch(err => {
  console.error(err);
  process.exit(1);
});
