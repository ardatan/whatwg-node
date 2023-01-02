import { createRouter } from '../src/createRouter';
import { withErrorHandling, Response } from '@whatwg-node/server';

describe('Router', () => {
  it('should have parsedUrl in Request object', async () => {
    const router = createRouter();
    router.get(
      '/greetings/:name',
      request =>
        new Response(
          JSON.stringify({
            message: `Hello ${request.parsedUrl.pathname}!`,
          })
        )
    );
    const response = await router.fetch('http://localhost/greetings/John');
    const json = await response.json();
    expect(json.message).toBe('Hello /greetings/John!');
  });
  it('should process parameters in the path', async () => {
    const router = createRouter();
    router.get(
      '/greetings/:name',
      request =>
        new Response(
          JSON.stringify({
            message: `Hello ${request.params.name}!`,
          })
        )
    );
    const response = await router.fetch('http://localhost/greetings/John');
    const json = await response.json();
    expect(json.message).toBe('Hello John!');
  });
  it('should process query parameters', async () => {
    const router = createRouter();
    router.get(
      '/greetings',
      request =>
        new Response(
          JSON.stringify({
            message: `Hello ${request.query.name}!`,
          })
        )
    );
    const response = await router.fetch('http://localhost/greetings?name=John');
    const json = await response.json();
    expect(json.message).toBe('Hello John!');
  });
  it('should process multiple handlers for the same route', async () => {
    const router = createRouter();
    router.get(
      '/greetings',
      (request: any) => {
        request.message = 'Hello';
      },
      (request: any) => {
        request.message += ` ${request.query.name}!`;
        return new Response(JSON.stringify({ message: request.message }));
      }
    );
    const response = await router.fetch('http://localhost/greetings?name=John');
    const json = await response.json();
    expect(json.message).toBe('Hello John!');
  });

  it('can match multiple routes if earlier handlers do not return (as middleware)', async () => {
    const router = createRouter();
    router.get(
      '/greetings',
      (request: any) => {
        request.message = 'Hello';
      },
      (request: any) => {
        request.message += ` to you`;
      }
    );
    router.get('/greetings', (request: any) => {
      request.message += ` ${request.query.name}!`;
      return new Response(JSON.stringify({ message: request.message }));
    });
    const response = await router.fetch('http://localhost/greetings?name=John');
    const json = await response.json();
    expect(json.message).toBe('Hello to you John!');
  });
  it('can pull route params from the basepath as well', async () => {
    const router = createRouter({ base: '/api' });
    router.get(
      '/greetings/:name',
      request =>
        new Response(
          JSON.stringify({
            message: `Hello ${request.params.name}!`,
          })
        )
    );
    const response = await router.fetch('http://localhost/api/greetings/John');
    const json = await response.json();
    expect(json.message).toBe('Hello John!');
  });

  it('can handle nested routers', async () => {
    const router = createRouter();
    const nested = createRouter({
      base: '/api',
    });
    nested.get(
      '/greetings/:name',
      request =>
        new Response(
          JSON.stringify({
            message: `Hello ${request.params.name}!`,
          })
        )
    );
    router.get('/api/*', nested);
    const response = await router.fetch('http://localhost/api/greetings/John');
    const json = await response.json();
    expect(json.message).toBe('Hello John!');
  });

  it('can get query params', async () => {
    const router = createRouter();
    router.get(
      '/foo',
      request =>
        new Response(
          JSON.stringify({
            cat: request.query.cat,
            foo: request.query.foo,
            missing: request.query.missing,
          })
        )
    );
    const response = await router.fetch('https://foo.com/foo?cat=dog&foo=bar&foo=baz&missing=');
    const json = await response.json();
    expect(json).toMatchObject({ cat: 'dog', foo: ['bar', 'baz'], missing: '' });
  });
  it('supports "/" with base', async () => {
    const router = createRouter({
      base: '/api',
    });
    router.get(
      '/',
      () =>
        new Response(
          JSON.stringify({
            message: `Hello Root!`,
          })
        )
    );
    const response = await router.fetch('http://localhost/api');
    const json = await response.json();
    expect(json.message).toBe('Hello Root!');
  });
  it('supports "/" without base', async () => {
    const router = createRouter();
    router.get(
      '/',
      () =>
        new Response(
          JSON.stringify({
            message: `Hello Root!`,
          })
        )
    );
    const response = await router.fetch('http://localhost');
    const json = await response.json();
    expect(json.message).toBe('Hello Root!');
  });
  it('supports "/" in the base', async () => {
    const router = createRouter({
      base: '/',
    });
    router.get(
      '/greetings',
      () =>
        new Response(
          JSON.stringify({
            message: `Hello World!`,
          })
        )
    );
    const response = await router.fetch('http://localhost/greetings');
    const json = await response.json();
    expect(json.message).toBe('Hello World!');
  });
  it('supports "/" both in the base and in the route', async () => {
    const router = createRouter({
      base: '/',
    });
    router.get(
      '/',
      () =>
        new Response(
          JSON.stringify({
            message: `Hello World!`,
          })
        )
    );
    const response = await router.fetch('http://localhost');
    const json = await response.json();
    expect(json.message).toBe('Hello World!');
  });
  it('handles POST bodies', async () => {
    const router = createRouter();
    router.post('/greetings', async request => {
      const json = await request.json();
      return new Response(
        JSON.stringify({
          message: `Hello ${json.name}!`,
        })
      );
    });
    const response = await router.fetch('http://localhost/greetings', {
      method: 'POST',
      body: JSON.stringify({ name: 'John' }),
    });
    const json = await response.json();
    expect(json.message).toBe('Hello John!');
  });
});
describe('withErrorHandling', () => {
  it('should return 500 when error is thrown', async () => {
    const router = createRouter({
      plugins: [withErrorHandling],
    });
    router.get('/greetings/:name', () => {
      throw new Error('Unexpected error');
    });
    const response = await router.fetch('http://localhost/greetings/John');
    expect(response.status).toBe(500);
    expect(response.statusText).toBe('Internal Server Error');
    const text = await response.text();
    expect(text).toContain('Error: Unexpected error');
  });
});
