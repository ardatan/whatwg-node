import { describe, expect, it } from '@jest/globals';
import * as fetchAPI from '@whatwg-node/fetch';
import { isolateObject } from '../src/utils';
import { sendResponseToUwsOpts } from '../src/uwebsockets';

describe('sendResponseToUwsOpts', () => {
  function createMockUwsResponse() {
    const writtenHeaders: [string, string][] = [];
    const mock = {
      writtenHeaders,
      onAborted(_cb: () => void) {},
      writeStatus(_status: string) {},
      writeHeader(key: string, value: string) {
        writtenHeaders.push([key, value]);
      },
      end(_body?: any) {},
      cork(cb: () => void) {
        cb();
      },
      write(_body: any) {
        return true;
      },
      close() {},
    };
    return mock;
  }

  it('should not forward transfer-encoding header to uWebSockets.js (graphql-yoga#4412)', () => {
    const mock = createMockUwsResponse();

    const fetchResponse = new fetchAPI.Response('hello', {
      status: 200,
      headers: {
        'content-type': 'text/plain',
        'transfer-encoding': 'chunked',
      },
    });

    sendResponseToUwsOpts(mock, fetchResponse, new AbortController(), fetchAPI as any);

    const transferEncodingHeaders = mock.writtenHeaders.filter(
      ([key]) => key === 'transfer-encoding',
    );
    expect(transferEncodingHeaders).toHaveLength(0);
  });

  it('should not forward transfer-encoding header for streaming responses (graphql-yoga#4412)', async () => {
    const mock = createMockUwsResponse();

    const encoder = new TextEncoder();
    const stream = new fetchAPI.ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('chunk1'));
        controller.enqueue(encoder.encode('chunk2'));
        controller.close();
      },
    });

    const fetchResponse = new fetchAPI.Response(stream, {
      status: 200,
      headers: {
        'content-type': 'multipart/mixed',
        'transfer-encoding': 'chunked',
      },
    });

    await sendResponseToUwsOpts(mock, fetchResponse, new AbortController(), fetchAPI as any);

    const transferEncodingHeaders = mock.writtenHeaders.filter(
      ([key]) => key === 'transfer-encoding',
    );
    expect(transferEncodingHeaders).toHaveLength(0);
  });
});

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
