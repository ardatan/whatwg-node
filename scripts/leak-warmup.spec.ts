import { describe, expect, it } from '@jest/globals';
import { closeSharedUndiciAgent } from '../packages/node-fetch/src/fetchUndici';
import { getUndici } from '../packages/node-fetch/src/getUndici';

const describeIf = (condition: boolean) => (condition ? describe : describe.skip);

describeIf(Boolean(process.env.LEAK_TEST))('leak-warmup', () => {
  it('warms the first Jest isolate (including optional undici)', async () => {
    // Same idea as Babel's first-isolate retention: load undici here so later
    // suites are not flagged for the one-time module / interceptor retain.
    const undici = getUndici();
    if (undici) {
      const agent = new undici.Agent({
        connections: 1,
        pipelining: 0,
        keepAliveTimeout: 1,
        keepAliveMaxTimeout: 1,
      }).compose(undici.interceptors.redirect(), undici.interceptors.decompress());
      await agent.destroy();
    }
    await closeSharedUndiciAgent();
    expect(true).toBe(true);
  });
});
