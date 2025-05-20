import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'bench',
      benchmark: {
        include: ['**/*.bench.ts'],
        reporters: ['verbose'],
        outputJson: 'bench/results.json',
      },
    },
  },
]);
