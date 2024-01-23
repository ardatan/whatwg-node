const { build } = require('esbuild');
const { writeFileSync } = require('fs');
const { join } = require('path');
const packageJson = require('../package.json');

const projectRoot = join(__dirname, '..');

async function main() {
  await build({
    entryPoints: [join(projectRoot, './src/index.ts')],
    outfile: join(projectRoot, 'dist/WhatWGNode/index.js'),
    format: 'cjs',
    minify: false,
    bundle: true,
    platform: 'node',
    target: 'node20',
    external: ['@azure/functions-core'],
  });

  writeFileSync(
    join(projectRoot, './dist/package.json'),
    JSON.stringify({
      name: 'whatwg-node-test-function',
      version: '0.0.1',
    }),
  );

  writeFileSync(
    join(projectRoot, './dist/host.json'),
    JSON.stringify({
      version: '2.0',
      logging: {
        applicationInsights: {
          samplingSettings: {
            isEnabled: true,
            excludedTypes: 'Request',
          },
        },
      },
      extensionBundle: {
        id: 'Microsoft.Azure.Functions.ExtensionBundle',
        version: '[3.15.0, 4.0.0)',
      },
      concurrency: {
        dynamicConcurrencyEnabled: true,
        snapshotPersistenceEnabled: true,
      },
    }),
  );

  console.info(`Azure Function build done!`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
