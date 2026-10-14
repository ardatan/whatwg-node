import { describe, expect, it } from '@jest/globals';
// Load packages that leak suites import into the disposable first isolate.
// Babel 8 + Jest --detectLeaks retains that isolate; see jest-leak-runner.cjs.
import '@whatwg-node/fetch';
import '@whatwg-node/node-fetch';
import '@whatwg-node/server';

const describeIf = (condition: boolean) => (condition ? describe : describe.skip);

describeIf(Boolean(process.env.LEAK_TEST))('leak-warmup', () => {
  it('warms the first Jest isolate', () => {
    expect(true).toBe(true);
  });
});
