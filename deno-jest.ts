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

const mocks: { mockClear: () => void }[] = [];

export const jest = {
  fn<T extends (...args: any[]) => any>(implementation?: T) {
    const f = fn(implementation);
    mocks.push(f);
    return f;
  },
  clearAllMocks: () => {
    mocks.forEach(mock => mock.mockClear());
  },
  spyOn(target: any, method: string) {
    Object.defineProperty(target, method, {
      value: fn(target[method]),
      writable: true,
    });
  },
};
