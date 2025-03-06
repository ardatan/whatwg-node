import { describe, expect, it } from '@jest/globals';
import { createServerAdapter, ServerAdapterPlugin } from '@whatwg-node/server';

describe('instrumentation', () => {
  it('should wrap request handler with instrumentation and automatically compose them', async () => {
    const results: string[] = [];

    function make(name: string): ServerAdapterPlugin {
      return {
        instrumentation: {
          request: async (_, wrapped) => {
            results.push(`pre-${name}`);
            await wrapped();
            results.push(`post-${name}`);
          },
        },
      };
    }

    const adapter = createServerAdapter<{}>(
      () => {
        results.push('request');
        return Response.json({ message: 'Hello, World!' });
      },
      {
        plugins: [make('1'), make('2'), make('3')],
      },
    );

    await adapter.fetch('http://whatwg-node/graphql');
    expect(results).toEqual(['pre-1', 'pre-2', 'pre-3', 'request', 'post-3', 'post-2', 'post-1']);
  });
});
