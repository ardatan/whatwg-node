import { serve } from 'https://deno.land/std@0.157.0/http/server.ts'
import { createTestServerAdapter } from '@e2e/shared-server';

serve(createTestServerAdapter(), {
    onListen({ hostname, port }) {
        console.log(`Listening on http://${hostname}:${port}`)
    },
})