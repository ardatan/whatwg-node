import { fn } from 'jsr:@std/expect';
import { it } from 'jsr:@std/testing/bdd';

it.each =
  (cases: object[]): typeof it =>
  (name, runner) => {
    for (const c of cases) {
      let testName = name;
      Object.entries(c).forEach(([k, v]) => {
        testName = testName.replaceAll(k, v);
      });
      it(testName, () => runner(c));
    }
  };
export { it };

export { describe, test, beforeEach, afterEach, beforeAll, afterAll } from 'jsr:@std/testing/bdd';
export { expect } from 'jsr:@std/expect';

export const jest = {
  fn,
  spyOn(target: any, method: string) {
    Object.defineProperty(target, method, {
      value: fn(target[method]),
      writable: true,
    });
  },
};
