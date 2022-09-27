import { createFetch } from "@whatwg-node/fetch";

export function createTestContainer(fn: (fetchAPI: ReturnType<typeof createFetch>) => void, extraFlags: Parameters<typeof createFetch>[0] = {}) {
    ['default-fetch', 'node-fetch'].forEach(fetchImplementation => {
        describe(fetchImplementation, () => {
            const fetchAPI = createFetch({
                useNodeFetch: fetchImplementation === 'node-fetch',
                ...extraFlags,
            });
            fn(fetchAPI);
        });
    })
} 