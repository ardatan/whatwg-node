import { describe, expect, it } from '@jest/globals';
import { isolateObject } from '../src/utils';

describe('isolateObject', () => {
  describe('Object.create', () => {
    it('property assignments', () => {
      const origin = isolateObject({});
      const a = Object.create(origin);
      const b = Object.create(origin);
      a.a = 1;
      expect(b.a).toEqual(undefined);
    });
    it('property assignments with defineProperty', () => {
      const origin = isolateObject({});
      const a = Object.create(origin);
      const b = Object.create(origin);
      Object.defineProperty(a, 'a', { value: 1 });
      expect(b.a).toEqual(undefined);
    });
    it('property deletions', () => {
      const origin = isolateObject({});
      const a = Object.create(origin);
      const b = Object.create(origin);
      b.a = 2;
      a.a = 1;
      delete a.a;
      expect(b.a).toEqual(2);
    });
    it('ownKeys', () => {
      const origin = isolateObject({});
      const a = Object.create(origin);
      const b = Object.create(origin);
      a.a = 1;
      expect(Object.keys(a)).toEqual(['a']);
      expect(Object.keys(b)).toEqual([]);
    });
    it('hasOwnProperty', () => {
      const origin = isolateObject({});
      const a = Object.create(origin);
      const b = Object.create(origin);
      a.a = 1;
      expect(a.hasOwnProperty('a')).toEqual(true);
      expect(b.hasOwnProperty('a')).toEqual(false);
    });
    it('getOwnPropertyDescriptor', () => {
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
