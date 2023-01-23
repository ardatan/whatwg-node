import { createServerAdapter } from '../src';
import { createTestContainer } from './create-test-container';

describe('adapter.fetch', () => {
  createTestContainer(({ Request }) => {
    // Request as first parameter
    it('should accept Request as a first argument', async () => {
      const handleRequest = jest.fn();
      const adapter = createServerAdapter(handleRequest, Request);
      const request = new Request('http://localhost:8080');
      await adapter(request);
      expect(handleRequest).toHaveBeenCalledWith(request, expect.anything());
    });
    it('should accept additional parameters as server context', async () => {
      const handleRequest = jest.fn();
      const adapter = createServerAdapter<{
        foo: string;
      }>(handleRequest, Request);
      const request = new Request('http://localhost:8080');
      const additionalCtx = { foo: 'bar' };
      await adapter.fetch(request, additionalCtx);
      expect(handleRequest).toHaveBeenCalledWith(request, expect.objectContaining(additionalCtx));
    });
    // URL as first parameter
    it('should accept URL as a first argument', async () => {
      const handleRequest = jest.fn();
      const adapter = createServerAdapter(handleRequest, Request);
      const url = new URL('http://localhost:8080');
      await adapter.fetch(url);
      expect(handleRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: url.toString(),
        }),
        expect.anything()
      );
    });
    it('should accept URL without a RequestInit but with an additional context', async () => {
      const handleRequest = jest.fn();
      const adapter = createServerAdapter<{
        foo: string;
      }>(handleRequest, Request);
      const url = new URL('http://localhost:8080');
      const additionalCtx = { foo: 'bar' };
      await adapter.fetch(url, additionalCtx);
      expect(handleRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: url.toString(),
        }),
        expect.objectContaining(additionalCtx)
      );
    });
    it('should accept URL with a RequestInit', async () => {
      const handleRequest = jest.fn();
      const adapter = createServerAdapter(handleRequest, Request);
      const url = new URL('http://localhost:8080');
      const init = {
        method: 'POST',
      };
      await adapter.fetch(url, init);
      expect(handleRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: url.toString(),
          method: init.method,
        }),
        expect.anything()
      );
    });
    it('should accept URL with a RequestInit and additional parameters as server context', async () => {
      const handleRequest = jest.fn();
      const adapter = createServerAdapter<{
        foo: string;
      }>(handleRequest, Request);
      const url = new URL('http://localhost:8080');
      const init = {
        method: 'POST',
      };
      const additionalCtx = { foo: 'bar' };
      await adapter.fetch(url, init, additionalCtx);
      expect(handleRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: url.toString(),
          method: init.method,
        }),
        expect.objectContaining(additionalCtx)
      );
    });

    // String as first parameter
    it('should accept string as a first argument', async () => {
      const handleRequest = jest.fn();
      const adapter = createServerAdapter(handleRequest, Request);
      const url = 'http://localhost:8080/';
      await adapter.fetch(url);
      expect(handleRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url,
        }),
        expect.anything()
      );
    });
    it('should accept string without a RequestInit but with an additional context', async () => {
      const handleRequest = jest.fn();
      const adapter = createServerAdapter<{
        foo: string;
      }>(handleRequest, Request);
      const url = 'http://localhost:8080/';
      const additionalCtx = { foo: 'bar' };
      await adapter.fetch(url, additionalCtx);
      expect(handleRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url,
        }),
        expect.objectContaining(additionalCtx)
      );
    });
    it('should accept string with a RequestInit', async () => {
      const handleRequest = jest.fn();
      const adapter = createServerAdapter(handleRequest, Request);
      const url = 'http://localhost:8080/';
      const init = {
        method: 'POST',
      };
      await adapter.fetch(url, init);
      expect(handleRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url,
          method: init.method,
        }),
        expect.anything()
      );
    });
    it('should accept string with a RequestInit and additional parameters as server context', async () => {
      const handleRequest = jest.fn();
      const adapter = createServerAdapter<{
        foo: string;
      }>(handleRequest, Request);
      const url = 'http://localhost:8080/';
      const init = {
        method: 'POST',
      };
      const additionalCtx = { foo: 'bar' };
      await adapter.fetch(url, init, additionalCtx);
      expect(handleRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url,
          method: init.method,
        }),
        expect.objectContaining(additionalCtx)
      );
    });
    it('should copy non-enumerable parameters as server context and keep their descriptors', async () => {
      const handleRequest = jest.fn();
      const adapter = createServerAdapter<any>(handleRequest, Request);
      const request = new Request('http://localhost:8080/');
      const env = { VAR: 'abc' };
      const additionalCtx = {};
      const waitUntil = () => {};
      // in Cloudflare Workers, waitUntil is a non-enumerable property
      Object.defineProperty(additionalCtx, 'waitUntil', { enumerable: false, value: waitUntil });
      adapter.fetch(request, env, additionalCtx);
      expect(handleRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: request.url }),
        expect.objectContaining(additionalCtx)
      );
      const passedServerCtx = handleRequest.mock.calls[0][1];
      expect(passedServerCtx.waitUntil).toBe(waitUntil);
      // test that enumerable stays false
      expect(Object.getOwnPropertyDescriptor(passedServerCtx, 'waitUntil')?.enumerable).toBe(false);
    });
    it('should ignore falsy and non object values', () => {
      const handleRequest = jest.fn();
      const adapter = createServerAdapter(handleRequest, Request) as any;
      const request = new Request('http://localhost:8080/');
      adapter.fetch(request, null, undefined, 0, false, 'abc', { foo: 'bar' });
      expect(handleRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: request.url }),
        expect.objectContaining({ foo: 'bar' })
      );
    });
  });
});
