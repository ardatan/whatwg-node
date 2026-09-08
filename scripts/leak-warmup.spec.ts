import { describe, expect, it } from '@jest/globals';

const describeIf = (condition: boolean) => (condition ? describe : describe.skip);

describeIf(Boolean(process.env.LEAK_TEST))('leak-warmup', () => {
  it('warms the first Jest isolate', () => {
    expect(true).toBe(true);
  });
});
