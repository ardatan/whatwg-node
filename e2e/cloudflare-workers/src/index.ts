import { createTestServerAdapter } from '@e2e/shared-server';

declare const WORKER_PATH: string;

const app = createTestServerAdapter({
  base: WORKER_PATH,
});

self.addEventListener('fetch', app);
