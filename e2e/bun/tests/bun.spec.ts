import { createTestServerAdapter } from '@e2e/shared-server';
import { describe, it } from 'bun:test'
import { Server } from 'bun'
import { assertDeployedEndpoint } from '@e2e/shared-scripts';

let server: Server
let url: string
function beforeEach() {
    server = Bun.serve({
        fetch: createTestServerAdapter(),
        port: 3000,
    })
    url = `http://${server.hostname}:${server.port}`
}

function afterEach() {
    server.stop()
}

describe('Bun', () => {
    it('works', async () => {
        beforeEach();
        try {
            await assertDeployedEndpoint(url);
        } finally {
            afterEach();
        }
    })
})