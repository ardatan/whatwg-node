import { createServerAdapter } from '@whatwg-node/server';
import { Router } from 'itty-router';
import { withParams } from 'itty-router-extras';
import { createFetch } from '@whatwg-node/fetch';

const { Request, Response } = createFetch({
  useNodeFetch: true,
});

export function createTestServerAdapter({ base }: { base?: string } = {}) {
  const app = createServerAdapter(Router({ base }), Request);

  app.get(
    '/greetings/:name',
    withParams,
    req =>
      new Response(
        JSON.stringify({
          message: `Hello ${req.params?.name}!`,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
  );

  app.post('/bye', async (req: Request) => {
    const { name } = await req.json();
    return new Response(
      JSON.stringify({
        message: `Bye ${name}!`,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  });

  app.get(
    '/',
    () =>
      new Response(
        `
    <html>
        <head>
            <title>Platform Agnostic Server</title>
        </head>
        <body>
            <p>Hello World!</p>
        </body>
    </html>
`,
        {
          headers: {
            'Content-Type': 'text/html',
          },
        }
      )
  );

  app.all('*', () => new Response('Not Found.', { status: 404 }));

  return app;
}
