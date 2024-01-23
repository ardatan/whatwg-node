import { createTestServerAdapter } from '@e2e/shared-server';

const app = createTestServerAdapter();

export default {
  fetch: app,
};
