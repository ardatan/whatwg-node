import { isolateObject } from '../src/utils';

describe('isolateObject', () => {
  test('Object.create does not share property assignments', () => {
    const origin = isolateObject({});
    const a = Object.create(origin);
    const b = Object.create(origin);
    a.a = 1;
    expect(b.a).toEqual(undefined);
  });
});
