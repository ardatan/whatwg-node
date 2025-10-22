import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      {
        test: {
          name: 'bench',
          benchmark: {
            include: ['**/*.bench.ts'],
            reporters: ['verbose'],
            outputJson: 'bench/results.json',
          },
        },
      },
    ],
  },
});
