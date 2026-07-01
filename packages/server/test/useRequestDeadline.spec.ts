import { describe, expect, it, jest } from '@jest/globals';
import { useRequestDeadline } from '../src/plugins/useRequestDeadline.js';
import { runTestsForEachFetchImpl } from './test-fetch.js';

function slowHandler(req: Request, fetchAPI: { Response: typeof Response }): Promise<Response> {
  return new Promise(resolve => {
    const timer = globalThis.setTimeout(() => {
      resolve(new fetchAPI.Response('ok', { status: 200 }));
    }, 500);
    req.signal.addEventListener('abort', () => globalThis.clearTimeout(timer), { once: true });
  });
}

describe('useRequestDeadline', () => {
  runTestsForEachFetchImpl(
    (_, { createServerAdapter, fetchAPI }) => {
      it('responds with the deadline response when the handler exceeds the timeout', async () => {
        const adapter = createServerAdapter(req => slowHandler(req, fetchAPI), {
          plugins: [
            useRequestDeadline({
              timeout: 50,
              response: () => new fetchAPI.Response('deadline', { status: 504 }),
            }),
          ],
          fetchAPI,
        });

        const response = await adapter.fetch('http://localhost/');
        expect(response.status).toBe(504);
        expect(await response.text()).toBe('deadline');
      });

      it('passes the request to the deadline response factory', async () => {
        let capturedRequest: Request | undefined;
        let deadlineFactoryRequest: Request | undefined;
        const adapter = createServerAdapter(
          req => {
            capturedRequest = req;
            return slowHandler(req, fetchAPI);
          },
          {
            plugins: [
              useRequestDeadline({
                timeout: 50,
                response: req => {
                  deadlineFactoryRequest = req;
                  return new fetchAPI.Response('deadline', { status: 504 });
                },
              }),
            ],
            fetchAPI,
          },
        );

        await adapter.fetch('http://localhost/test-path');
        expect(deadlineFactoryRequest).toBeDefined();
        // the request passed to the deadline factory is the same one the handler received
        expect(deadlineFactoryRequest).toBe(capturedRequest);
      });

      it('does not apply the deadline when the handler responds in time', async () => {
        const adapter = createServerAdapter(() => new fetchAPI.Response('ok', { status: 200 }), {
          plugins: [
            useRequestDeadline({
              timeout: 200,
              response: () => new fetchAPI.Response('deadline', { status: 504 }),
            }),
          ],
          fetchAPI,
        });

        const response = await adapter.fetch('http://localhost/');
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('ok');
      });

      it('aborts the request signal when the deadline fires', async () => {
        let handlerSignal: AbortSignal | undefined;
        const adapter = createServerAdapter(
          req => {
            handlerSignal = req.signal;
            return slowHandler(req, fetchAPI);
          },
          {
            plugins: [
              useRequestDeadline({
                timeout: 50,
                response: () => new fetchAPI.Response('deadline', { status: 504 }),
              }),
            ],
            fetchAPI,
          },
        );

        const response = await adapter.fetch('http://localhost/');
        expect(response.status).toBe(504);
        expect(handlerSignal?.aborted).toBe(true);
      });

      it('body is readable in the handler after the request signal is redefined with the deadline signal', async () => {
        let bodyText: string | undefined;
        const adapter = createServerAdapter(
          async req => {
            bodyText = await req.text();
            return new fetchAPI.Response('ok', { status: 200 });
          },
          {
            plugins: [
              useRequestDeadline({
                timeout: 5000,
                response: () => new fetchAPI.Response('deadline', { status: 504 }),
              }),
            ],
            fetchAPI,
          },
        );

        const response = await adapter.fetch(
          new fetchAPI.Request('http://localhost/', { method: 'POST', body: 'hello body' }),
        );
        expect(response.status).toBe(200);
        expect(bodyText).toBe('hello body');
      });

      it('calls onResponse hooks after the deadline response is produced', async () => {
        const onResponse = jest.fn(({ response }: { response: Response }) => {
          // hook receives the deadline response
          expect(response.status).toBe(504);
        });
        const adapter = createServerAdapter(req => slowHandler(req, fetchAPI), {
          plugins: [
            useRequestDeadline({
              timeout: 50,
              response: () => new fetchAPI.Response('deadline', { status: 504 }),
            }),
            { onResponse },
          ],
          fetchAPI,
        });

        const response = await adapter.fetch('http://localhost/');
        expect(response.status).toBe(504);
        expect(onResponse).toHaveBeenCalledTimes(1);
      });
    },
    { noLibCurl: true },
  );
});
