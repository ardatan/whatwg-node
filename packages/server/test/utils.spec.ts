import { isolateObject } from '../src/utils';

describe('isolateObject', () => {
  describe('Object.create', () => {
    test('property assignments', () => {
      const origin = isolateObject({});
      const a = Object.create(origin);
      const b = Object.create(origin);
      a.a = 1;
      expect(b.a).toEqual(undefined);
    });
    test('property assignments with defineProperty', () => {
      const origin = isolateObject({});
      const a = Object.create(origin);
      const b = Object.create(origin);
      Object.defineProperty(a, 'a', { value: 1 });
      expect(b.a).toEqual(undefined);
    });
    test('property deletions', () => {
      const origin = isolateObject({});
      const a = Object.create(origin);
      const b = Object.create(origin);
      b.a = 2;
      a.a = 1;
      delete a.a;
      expect(b.a).toEqual(2);
    });
    test('ownKeys', () => {
      const origin = isolateObject({});
      const a = Object.create(origin);
      const b = Object.create(origin);
      a.a = 1;
      expect(Object.keys(a)).toEqual(['a']);
      expect(Object.keys(b)).toEqual([]);
    });
    test('hasOwnProperty', () => {
      const origin = isolateObject({});
      const a = Object.create(origin);
      const b = Object.create(origin);
      a.a = 1;
      expect(a.hasOwnProperty('a')).toEqual(true);
      expect(b.hasOwnProperty('a')).toEqual(false);
    });
    test('getOwnPropertyDescriptor', () => {
      const origin = isolateObject({});
      const a = Object.create(origin);
      const b = Object.create(origin);
      a.a = 1;
      const desc = Object.getOwnPropertyDescriptor(a, 'a');
      expect(desc?.value).toEqual(1);
      expect(Object.getOwnPropertyDescriptor(b, 'a')).toEqual(undefined);
    });
  });
});
