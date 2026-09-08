import { describe, expect, it } from '@jest/globals';

describe('leak-warmup', () => {
  it('warms the first Jest isolate', () => {
    expect(true).toBe(true);
  });
});
