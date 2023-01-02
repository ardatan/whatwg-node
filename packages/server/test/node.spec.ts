import { createServerAdapter } from '@whatwg-node/server';
import { IncomingMessage, ServerResponse } from 'http';
import { createTestServer, TestServer } from './test-server';
import { createTestContainer } from './create-test-container';
import {
  createSecureServer as createHttp2SecureServer,
  connect as connectHttp2,
  constants as constantsHttp2,
} from 'http2';
import { AddressInfo } from 'net';
import { createFetch } from '@whatwg-node/fetch';

describe('Node Specific Cases', () => {
  let testServer: TestServer;
  beforeAll(async () => {
    testServer = await createTestServer();
  });

  afterAll(done => {
    testServer.server.close(done);
  });

  createTestContainer(({ Request, Response, ReadableStream, fetch }) => {
    it('should handle empty responses', async () => {
      const serverAdapter = createServerAdapter(() => {
        return undefined as any;
      }, Request);
      testServer.server.once('request', serverAdapter);
      const response = await fetch(testServer.url);
      await response.text();
      expect(response.status).toBe(404);
    });

    it('should handle waitUntil properly', async () => {
      let flag = false;
      const serverAdapter = createServerAdapter((_request, { waitUntil }) => {
        waitUntil(
          sleep(100).then(() => {
            flag = true;
          })
        );
        return new Response(null, {
          status: 204,
        });
      }, Request);
      testServer.server.once('request', serverAdapter);
      const response$ = fetch(testServer.url);
      const response = await response$;
      await response.text();
      expect(flag).toBe(false);
      await sleep(100);
      expect(flag).toBe(true);
    });

    it('should forward additional context', async () => {
      const handleRequest = jest.fn().mockImplementation(() => {
        return new Response(null, {
          status: 204,
        });
      });
      const serverAdapter = createServerAdapter<{
        req: IncomingMessage;
        res: ServerResponse;
        foo: string;
      }>(handleRequest, Request);
      const additionalCtx = { foo: 'bar' };
      testServer.server.once('request', (...args) => serverAdapter(...args, additionalCtx));
      const response = await fetch(testServer.url);
      await response.text();
      expect(handleRequest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining(additionalCtx));
    });

    it('should handle cancellation of incremental responses', async () => {
      const cancelFn = jest.fn();
      const serverAdapter = createServerAdapter(
        () =>
          new Response(
            new ReadableStream({
              async pull(controller) {
                await sleep(100);
                controller.enqueue(Date.now().toString());
              },
              cancel: cancelFn,
            })
          ),
        Request
      );

      testServer.server.once('request', serverAdapter);
      const response = await fetch(testServer.url);

      const collectedValues: string[] = [];

      let i = 0;
      for await (const chunk of response.body as any as AsyncIterable<Uint8Array>) {
        if (i > 2) {
          break;
        }
        collectedValues.push(Buffer.from(chunk).toString('utf-8'));
        i++;
      }

      expect(collectedValues).toHaveLength(3);
      await sleep(100);
      expect(cancelFn).toHaveBeenCalledTimes(1);
    });
  });

  it.each([
    {
      fetchImpl: 'default',
      fetchAPI: createFetch({ useNodeFetch: false }),
    },
    {
      fetchImpl: 'node-fetch',
      fetchAPI: createFetch({ useNodeFetch: true }),
    },
  ])('should support http2 and respond as expected when using $fetchImpl implementation', async ({ fetchAPI }) => {
    const adapter = createServerAdapter(req => {
      expect(req.method).toBe('POST');
      // TODO: only passes if create-node-ponyfill.js is used
      // expect(req.headers.get('host')).toMatch(/^localhost:\d+$/);
      // expect(req.url).toMatch(/^https:\/\/localhost:\d+\/hi$/);
      return new fetchAPI.Response('Hey there!', { status: 418, headers: { 'x-is-this-http2': 'yes' } });
    }, fetchAPI.Request);

    const key = `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDL2k3sKtqBQ9lw
ouLuCewSuTCazFjSdzJKLWmm9d9OLRi9SVPaIaes0ItExHFXwVNSXGUlabTSXxVP
x9cJXDtloBnlN+YKK5f8vcpP7a9hquYDKMhM27kP6e8CIugDfXP4rz52o6Jn2ZEz
JrzpbrF3eDtD4uVfXfZeAgR9jilfFI+L5qu5AjZSWtL/YwqVRus1r3ChXBOgvLy/
MN7NJ1W7fDgyCLge1HvDGPidyrHoVezGEtzWUpGatgR6PNhdtI5M/bf+l4+xAHL6
sYeTpg6iAsrE+K3VkBIFgxye7lzXUIXyeQ6ij3DsBVlT6bY80g1QpcTDBoXCOnkS
GEyFuC33AgMBAAECggEBAK7FA8d1Wg43GGW8EKiaMx4+TVB537DZZnE4C/uLkp6Y
hTxLcKtz7Sh5Rt13OeFNqtzSwBjaTp+Jy2Cx6UdqHrZbE7h0OzH++/hA0wHBunoW
pcqRnWBfhIMDQdloCdhsJxBPVlMqqWM1oYnkLVRIhbfyiYUDMzmW+lDQk/788bVE
BmTVY9qkHYt+6Cu97Wt4mVQZS6CS9oaJn3btuUbT7V3x3q5ER7jRmwRUPwFc4uVv
lEFP/UCc3JeK+rEoZVVcafImetLfzwTszQ18BV5Y4plt+kB7OFW8OVpAgrnK6e3g
+RVsN3FhN6QkgkWhhpQOVCqBTNphxmrOnL3shmEJ7gECgYEA/qGeSA+l3Wh9+aUk
wBo7nsyqJa/61K10uLNe47tJe5ZxB11lT3JCNvNhuJ/BTxiGclRTRCSl/VQOZ3JY
s6TR3i6LtykfypyaQCjMDWXRZpEoBpEdwKP+o/9M03oIRs3eGxTm83iC/GCYooQR
tfHJMLlgQufsq5+uGnU/7QMGDwECgYEAzPLQH/lsM7yROyc7Q877scFnYVLX/U+r
6lQROFWuLM3a3DGafg9+kFziZVK7jQ41z/EywuU//XH7UtrjmVlGRZCSbhFGPokw
gO4q2KaDuFyq1iSRIorj3pjXO+zYZoX7fcbMInlpC+oBpU+S1jyRreGgdhkEXtYq
9bQSUntTtPcCgYEA1T661PSt3tfUsI7aUTtm9N3IHNndQeGmH8ywSh4eMy9Rp25T
Gw7AX07CZyD7fmc2qWbveOEMVjTf/0hm+sOsstreTV1Wb5NpJxRDl3DOxowILj+3
4A43glabm3vWlJ1yRdHifMJPSFcJXQkn3+0GphSJhl6++Rg4cZYCHFbs6wECgYEA
xsAWa1uTvdx5LtdN1uVsGqbHHY+cXFAeFOGvzWTxwwti2jTUcLmP8GnTN5Vywkjs
kJqEspJlauBVbLVPENCNoDqidlEUQOMEAZR2QqHAjVJ4bbEKemgcsSqhV8DI3yvB
huj539jDsUUekXTInjAgynJLDRwXq+yfvqUBO7HTrGMCgYBmPS4dcLoBC04MiSIQ
mDYzpcI51XzlyJPQQKjHjck5H4WDV80EIX22krvFMh44IOyqZu3Ou+iSPCR1hi1z
Mp0YOF+YKJ9PCrJu4W/xt1pnxfXe9bTg5HKtN6DmYlSz78EMelSVemaqOgNoIBqC
t6Ra3NuebwL/VQ1JpBhh4eJYZg==
-----END PRIVATE KEY-----`;
    const cert = `-----BEGIN CERTIFICATE-----
MIICpDCCAYwCCQClE698xX22XDANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDDAls
b2NhbGhvc3QwHhcNMjIxMjI4MTc0NDMxWhcNMjMwMTI3MTc0NDMxWjAUMRIwEAYD
VQQDDAlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDL
2k3sKtqBQ9lwouLuCewSuTCazFjSdzJKLWmm9d9OLRi9SVPaIaes0ItExHFXwVNS
XGUlabTSXxVPx9cJXDtloBnlN+YKK5f8vcpP7a9hquYDKMhM27kP6e8CIugDfXP4
rz52o6Jn2ZEzJrzpbrF3eDtD4uVfXfZeAgR9jilfFI+L5qu5AjZSWtL/YwqVRus1
r3ChXBOgvLy/MN7NJ1W7fDgyCLge1HvDGPidyrHoVezGEtzWUpGatgR6PNhdtI5M
/bf+l4+xAHL6sYeTpg6iAsrE+K3VkBIFgxye7lzXUIXyeQ6ij3DsBVlT6bY80g1Q
pcTDBoXCOnkSGEyFuC33AgMBAAEwDQYJKoZIhvcNAQELBQADggEBAL3BU99gtkpT
9KwkFtn18+j3OFaJzoj+WPrC0YvbPx3KqnZeEH3MvqyRk7WMcUVrPnmLY9S7oPYb
AYpkSwuvh0374zVcAn0CYRWSafj6nM9xmEWk3F28jfF+XemS1F8/Z0NyLJSVytIb
bdEO2Po5v+S/RlE/QE7ONaKYecOPMTcW7FeEze77DOJXTvkuM5ab/Wj1mbSE40sH
VhEJmi7pGnPZOobUh3QhhpvqJ4myRCyrHKS53l1RJJ+7/XXVq6WDHAcMxHseRKnb
ziIZM/48ENV+m5yXVvUZJaKOggThi+RhLSwIyVzn8ScawkXS70bZtI4CrSTXu3H9
/huiHkWkMUs=
-----END CERTIFICATE-----`;

    const server = createHttp2SecureServer({ key, cert }, adapter);
    server.listen(0);
    const port = (server.address() as AddressInfo).port;

    // Node's fetch API does not support HTTP/2, we use the http2 module directly instead

    const client = connectHttp2(`https://localhost:${port}`, { ca: cert });

    const req = client.request({
      [constantsHttp2.HTTP2_HEADER_METHOD]: 'POST',
      [constantsHttp2.HTTP2_HEADER_PATH]: '/hi',
    });

    await expect(
      new Promise((resolve, reject) => {
        req.on(
          'response',
          ({
            date, // omit date from snapshot
            ...headers
          }) => {
            let data = '';
            req.on('data', chunk => {
              data += chunk;
            });
            req.on('end', () => {
              resolve({
                headers,
                data,
              });
            });
          }
        );
        req.on('error', reject);
      })
    ).resolves.toMatchInlineSnapshot(`
      {
        "data": "Hey there!",
        "headers": {
          ":status": 418,
          "content-type": "text/plain;charset=UTF-8",
          "x-is-this-http2": "yes",
          Symbol(nodejs.http2.sensitiveHeaders): [],
        },
      }
    `);

    req.end();
    client.close();
    server.close();
  });
});

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
