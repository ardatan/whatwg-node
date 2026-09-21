import { describe, expect, it, jest } from '@jest/globals';
import * as DefaultFetchAPI from '@whatwg-node/fetch';
import {
  discardUnreadUWSRequestBody,
  getRequestFromUWSRequest,
  type UWSRequest,
  type UWSResponse,
} from '../src/uwebsockets.js';

function createMockUWS(method = 'post') {
  let onData: ((chunk: ArrayBuffer, isLast: boolean) => void) | undefined;
  const res = {
    onData: jest.fn((cb: (chunk: ArrayBuffer, isLast: boolean) => void) => {
      onData = cb;
    }),
    onAborted: jest.fn(),
    writeStatus: jest.fn(),
    writeHeader: jest.fn(),
    end: jest.fn(),
    close: jest.fn(),
    write: jest.fn(() => true),
    cork: jest.fn((cb: () => void) => cb()),
  } as unknown as UWSResponse;
  const req = {
    getMethod: () => method,
    forEach: (cb: (key: string, value: string) => void) => {
      const headerName = 'content-type';
      const headerValue = 'application/octet-stream';
      cb(headerName, headerValue);
    },
    getUrl: () => '/upload',
    getQuery: () => '',
    getHeader: () => undefined,
    setYield: jest.fn(),
  } as unknown as UWSRequest;
  return {
    req,
    res,
    push(chunk: Uint8Array, isLast: boolean) {
      if (!onData) {
        throw new Error('onData was not registered');
      }
      onData(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength), isLast);
    },
  };
}

describe('uWS lazy onData', () => {
  it('does not register onData until the body is read', () => {
    const { req, res } = createMockUWS();
    getRequestFromUWSRequest({
      req,
      res,
      fetchAPI: DefaultFetchAPI,
      controller: new AbortController(),
    });
    expect(res.onData).not.toHaveBeenCalled();
  });

  it('registers a drain-only onData when the body is never read', () => {
    const { req, res, push } = createMockUWS();
    const request = getRequestFromUWSRequest({
      req,
      res,
      fetchAPI: DefaultFetchAPI,
      controller: new AbortController(),
    });
    discardUnreadUWSRequestBody(request);
    expect(res.onData).toHaveBeenCalledTimes(1);
    // Drain must accept bytes without throwing / buffering for later reads.
    push(new TextEncoder().encode('hello'), false);
    push(new TextEncoder().encode('world'), true);
  });

  it('registers a consuming onData when request.text() is used', async () => {
    const { req, res, push } = createMockUWS();
    const request = getRequestFromUWSRequest({
      req,
      res,
      fetchAPI: DefaultFetchAPI,
      controller: new AbortController(),
    });
    const textPromise = request.text();
    expect(res.onData).toHaveBeenCalledTimes(1);
    push(new TextEncoder().encode('abc'), true);
    await expect(textPromise).resolves.toBe('abc');
  });

  it('does not switch to drain after the body has already been consumed', async () => {
    const { req, res, push } = createMockUWS();
    const request = getRequestFromUWSRequest({
      req,
      res,
      fetchAPI: DefaultFetchAPI,
      controller: new AbortController(),
    });
    const textPromise = request.text();
    push(new TextEncoder().encode('xyz'), true);
    await expect(textPromise).resolves.toBe('xyz');
    discardUnreadUWSRequestBody(request);
    expect(res.onData).toHaveBeenCalledTimes(1);
  });

  it('does not register onData for GET', () => {
    const { req, res } = createMockUWS('get');
    const request = getRequestFromUWSRequest({
      req,
      res,
      fetchAPI: DefaultFetchAPI,
      controller: new AbortController(),
    });
    discardUnreadUWSRequestBody(request);
    expect(res.onData).not.toHaveBeenCalled();
    expect(request.body).toBeNull();
  });
});
