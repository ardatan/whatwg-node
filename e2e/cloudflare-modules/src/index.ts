import { createTestServerAdapter } from '@e2e/shared-server';

export default {
  async fetch(request: Request, env: Record<string, string>, ctx: any): Promise<Response> {
    const app = createTestServerAdapter();
    return app.handle(request, env, ctx);
  },
};
