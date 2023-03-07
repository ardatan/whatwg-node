import { createTestServerAdapter } from '@e2e/shared-server';

const app = createTestServerAdapter();

self.addEventListener('fetch', app);
