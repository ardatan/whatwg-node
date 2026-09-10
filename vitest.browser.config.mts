import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // Workspace package.json exports point at dist/; unit CI does not build.
    // Resolve to source (and fetch's committed ponyfill) so Vitest matches Jest.
    alias: {
      '@whatwg-node/promise-helpers': path.join(root, 'packages/promise-helpers/src/index.ts'),
      '@whatwg-node/disposablestack': path.join(root, 'packages/disposablestack/src/index.ts'),
      '@whatwg-node/cookie-store': path.join(root, 'packages/cookie-store/src/index.ts'),
      '@whatwg-node/events': path.join(root, 'packages/events/src/index.ts'),
      '@whatwg-node/node-fetch': path.join(root, 'packages/node-fetch/src/index.ts'),
      '@whatwg-node/server': path.join(root, 'packages/server/src/index.ts'),
      // packages/fetch ships committed dist/ (bob: false)
      '@whatwg-node/fetch': path.join(root, 'packages/fetch/dist/global-ponyfill.js'),
    },
  },
  test: {
    name: 'browser',
    include: ['packages/**/*.browser.e2e.ts'],
    environment: 'node',
    globals: true,
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    server: {
      deps: {
        // So @envelop/instrumentation imports of workspace packages use the aliases above.
        inline: [/@envelop\//],
      },
    },
  },
});
