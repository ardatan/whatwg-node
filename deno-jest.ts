import { fn } from 'jsr:@std/expect';

export {
  describe,
  it,
  test,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from 'jsr:@std/testing/bdd';
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
