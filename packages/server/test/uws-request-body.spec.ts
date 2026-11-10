import { describe, expect, it } from '@jest/globals';
import { getRequestFromUWSRequest, type UWSRequest, type UWSResponse } from '../src/uwebsockets';
import { runTestsForEachFetchImpl } from './test-fetch';

runTestsForEachFetchImpl((_impl, { fetchAPI }) => {
  describe('getRequestFromUWSRequest body stream', () => {
    function mockUWS(method = 'post'): {
      req: UWSRequest;
      res: UWSResponse;
      deliver: (chunk: ArrayBuffer, isLast: boolean) => void;
    } {
      let onData: ((chunk: ArrayBuffer, isLast: boolean) => void) | undefined;
      const req: UWSRequest = {
        getMethod: () => method,
        forEach() {},
        getUrl: () => '/upload',
        getQuery: () => '',
        getHeader() {
          return undefined;
        },
        setYield() {},
      };
      const res = {
        onData(callback: (chunk: ArrayBuffer, isLast: boolean) => void) {
          onData = callback;
        },
      } as UWSResponse;
      return {
        req,
        res,
        deliver(chunk, isLast) {
          if (!onData) {
            throw new Error('onData was not registered');
          }
          onData(chunk, isLast);
        },
      };
    }

    it('closes after empty final onData when a chunk is still queued', async () => {
      const { req, res, deliver } = mockUWS();
      const request = getRequestFromUWSRequest({
        req,
        res,
        fetchAPI,
        controller: new AbortController(),
      });
      const bytes = new TextEncoder().encode('hello');
      deliver(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), false);
      const reader = request.body!.getReader();
      deliver(new ArrayBuffer(0), true);
      const first = await reader.read();
      expect(first.done).toBe(false);
      expect(new TextDecoder().decode(first.value)).toBe('hello');
      const second = await reader.read();
      expect(second.done).toBe(true);
    });

    it('keeps a clone readable after cancel before empty final onData', async () => {
      const { req, res, deliver } = mockUWS();
      const request = getRequestFromUWSRequest({
        req,
        res,
        fetchAPI,
        controller: new AbortController(),
      });
      const bytes = new TextEncoder().encode('hello');
      deliver(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), false);
      const clone = request.clone();
      // Create both streams before cancel/final so both register stop callbacks.
      const originalBody = request.body!;
      const cloneReader = clone.body!.getReader();
      await originalBody.cancel();
      deliver(new ArrayBuffer(0), true);
      const first = await cloneReader.read();
      expect(first.done).toBe(false);
      expect(new TextDecoder().decode(first.value)).toBe('hello');
      const second = await cloneReader.read();
      expect(second.done).toBe(true);
    });
  });
});
