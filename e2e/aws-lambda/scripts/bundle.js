const { build } = require('esbuild');
const nativeNodeModulesPlugin = require('../../shared-scripts/scripts/native-node-modules.plugin');

async function main() {
  await build({
    entryPoints: ['./src/index.ts'],
    outfile: 'dist/index.js',
    format: 'cjs',
    minify: false,
    bundle: true,
    platform: 'node',
    target: 'es2020',
    plugins: [nativeNodeModulesPlugin],
  });

  console.info(`AWS Lambda build done!`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
