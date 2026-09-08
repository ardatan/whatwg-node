import { createSecureServer, ServerHttp2Session, type Http2SecureServer } from 'node:http2';
import { AddressInfo } from 'node:net';
import tls from 'node:tls';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { createEphemeralTlsCerts } from '../../server/test/test-tls-certs';
import { fetchPonyfill } from '../src/fetch';

const describeIf = (condition: boolean) => (condition ? describe : describe.skip);
describeIf(
  globalThis.libcurl &&
    !process.env.LEAK_TEST &&
    !globalThis.Deno &&
    typeof tls.setDefaultCACertificates === 'function',
)('http2', () => {
  let server: Http2SecureServer;
  let previousDefaultCaCerts: string[];
  const sessions = new Set<ServerHttp2Session>();
  beforeAll(async () => {
    const { caCert, serviceKey, certificate } = await createEphemeralTlsCerts();
    previousDefaultCaCerts = tls.getCACertificates('default');
    tls.setDefaultCACertificates([...previousDefaultCaCerts, caCert]);
    // Create a secure HTTP/2 server
    server = createSecureServer(
      {
        allowHTTP1: false,
        key: serviceKey,
        cert: certificate,
      },
      (request, response) => {
        response.writeHead(200, {
          'Content-Type': 'application/json',
        });
        response.end(JSON.stringify(request.headers));
      },
    );

    server.on('session', session => {
      sessions.add(session);
      session.once('close', () => {
        sessions.delete(session);
      });
    });

    await new Promise<void>(resolve => server.listen(0, resolve));
  });
  afterAll(async () => {
    tls.setDefaultCACertificates(previousDefaultCaCerts);
    for (const session of sessions) {
      session.destroy();
    }
    await new Promise(resolve => server.close(resolve));
  });
  it('works', async () => {
    const res = await fetchPonyfill(`https://localhost:${(server.address() as AddressInfo).port}`, {
      headers: {
        'x-foo': 'bar',
      },
    });
    const resJson = await res.json();
    expect(resJson['x-foo']).toBe('bar');
  });
});
