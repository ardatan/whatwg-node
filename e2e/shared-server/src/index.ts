import { createRouter, Response, useErrorHandling } from '@whatwg-node/router';

export function createTestServerAdapter<TServerContext = {}>(base?: string) {
  const app = createRouter<TServerContext>({
    base,
    plugins: [useErrorHandling()],
  });

  app.get('/greetings/:name', req => Response.json({ message: `Hello ${req.params?.name}!` }));

  app.post('/bye', async req => {
    const { name } = await req.json();
    return Response.json({ message: `Bye ${name}!` });
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
          status: 200,
        },
      ),
  );

  app.all('*', () => new Response('Not Found.', { status: 404 }));

  return app;
}
