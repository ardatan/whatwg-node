import { createServerAdapter } from "../src";

describe('Request Container', () => {
    it('should receive correct request and container as a context', async () => {
        const handleRequest = jest.fn();
        const adapter = createServerAdapter(handleRequest);
        const requestContainer = {
            request: new Request('http://localhost:8080'),
        }
        await adapter(requestContainer);
        expect(handleRequest).toHaveBeenCalledWith(requestContainer.request, expect.objectContaining(requestContainer));
    });
    it('should accept additional parameters as server context', async () => {
        const handleRequest = jest.fn();
        const adapter = createServerAdapter<{
            foo: string;
        }>(handleRequest);
        const requestContainer = {
            request: new Request('http://localhost:8080'),
            foo: 'bar',
        }
        await adapter(requestContainer);
        expect(handleRequest).toHaveBeenCalledWith(requestContainer.request, expect.objectContaining(requestContainer));
    })
})