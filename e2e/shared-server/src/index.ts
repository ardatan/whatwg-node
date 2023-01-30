import {
  createRouter,
  DefaultServerAdapterContext,
  Response,
  withErrorHandling,
} from '@whatwg-node/router';

export function createTestServerAdapter<TServerContext = DefaultServerAdapterContext>(
  base?: string,
) {
  const app = createRouter<TServerContext>({
    base,
    plugins: [withErrorHandling as any],
  });

  app.get(
    '/greetings/:name',
    req =>
      new Response(
        JSON.stringify({
          message: `Hello ${req.params?.name}!`,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
  );

  app.post('/bye', async req => {
    const { name } = await req.json();
    return new Response(
      JSON.stringify({
        message: `Bye ${name}!`,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
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
        },
      ),
  );

  app.all('*', () => new Response('Not Found.', { status: 404 }));

  return app;
}
