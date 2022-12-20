import { createRouter } from "../src"

describe('Router', () => {
    it('should have parsedUrl in Request object', async () => {
        const router = createRouter();
        router.get('/greetings/:name', request => new Response(JSON.stringify({
            message: `Hello ${request.parsedUrl.pathname}!`,
        })))
        const response = await router.fetch('http://localhost/greetings/John');
        const json = await response.json();
        expect(json.message).toBe('Hello /greetings/John!');
    });
})