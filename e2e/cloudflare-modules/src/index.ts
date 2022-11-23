import { createTestServerAdapter } from '@e2e/shared-server';

export default {
  fetch(request: Request, env: Record<string, string>, ctx: any): Promise<Response> {
    const app = createTestServerAdapter({
      base: env.WORKER_PATH,
    });
    return app.handle(request, env, ctx);
  },
};
