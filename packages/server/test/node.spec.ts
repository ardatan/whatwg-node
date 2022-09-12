import { createServerAdapter } from "@whatwg-node/server";
import getPort from "get-port";
import { createServer, Server } from "http";

describe('Node Specific Cases', () => {
    let port: number;
    let server: Server | undefined;
    beforeEach(async () => {
        port = await getPort();
    })
    afterEach(done => {
        if (server) {
            server.close(err => {
                if (err) {
                    throw err;
                }
                server = undefined;
                done();
            });
        } else {
            done();
        }
    })
    it('should handle empty responses', async () => {
        const serverAdapter = createServerAdapter({
            async handleRequest() {
                return undefined as any;
            },
        })
        server = createServer(serverAdapter);
        await new Promise<void>(resolve => server!.listen(port, resolve));
        const response = await fetch(`http://localhost:${port}`);
        await response.text();
        expect(response.status).toBe(404);
    })
    it('should handle waitUntil properly', async () => {
        let flag = false;
        const serverAdapter = createServerAdapter({
            async handleRequest(_request, { waitUntil }) {
                waitUntil(Promise.resolve().then(() => {
                    flag = true;
                }))
                return new Response(null, {
                    status: 204,
                })
            }
        });
        server = createServer(serverAdapter);
        await new Promise<void>(resolve => server!.listen(port, resolve));
        const response = await fetch(`http://localhost:${port}`);
        expect(flag).toBe(true);
        await response.text();
    })
})
