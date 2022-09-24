import { createServerAdapter } from '../src';
import { Request } from '@whatwg-node/fetch';

describe('fetch', () => {
  // Request as first parameter
  it('should accept Request as a first argument', async () => {
    const handleRequest = jest.fn();
    const adapter = createServerAdapter(handleRequest);
    const request = new Request('http://localhost:8080');
    await adapter(request);
    expect(handleRequest).toHaveBeenCalledWith(request, expect.anything());
  });
  it('should accept additional parameters as server context', async () => {
    const handleRequest = jest.fn();
    const adapter = createServerAdapter<{
      foo: string;
    }>(handleRequest);
    const request = new Request('http://localhost:8080');
    const additionalCtx = { foo: 'bar' };
    await adapter.fetch(request, additionalCtx);
    expect(handleRequest).toHaveBeenCalledWith(request, expect.objectContaining(additionalCtx));
  });
  // URL as first parameter
  it('should accept URL as a first argument', async () => {
    const handleRequest = jest.fn();
    const adapter = createServerAdapter(handleRequest);
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
    }>(handleRequest);
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
    const adapter = createServerAdapter(handleRequest);
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
    }>(handleRequest);
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
    const adapter = createServerAdapter(handleRequest);
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
    }>(handleRequest);
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
    const adapter = createServerAdapter(handleRequest);
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
    }>(handleRequest);
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
});
