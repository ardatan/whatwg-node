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
});
describe('withErrorHandling', () => {
  it('should return 500 when error is thrown', async () => {
    const router = withErrorHandling(createRouter());
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
