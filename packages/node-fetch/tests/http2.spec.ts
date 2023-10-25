import { createSecureServer, type Http2SecureServer } from 'node:http2';
import { AddressInfo } from 'node:net';
import { CertificateCreationResult, createCertificate } from 'pem';
import { fetchPonyfill } from '../src/fetch';

describe('http2', () => {
  if (!globalThis.libcurl || !process.env.LEAK_TEST) {
    it('noop', () => {});
    return;
  }
  let server: Http2SecureServer;
  beforeAll(async () => {
    const keys = await new Promise<CertificateCreationResult>((resolve, reject) => {
      createCertificate(
        {
          selfSigned: true,
          days: 1,
        },
        (err, result) => {
          if (err) {
            reject(err);
          }
          resolve(result);
        },
      );
    });
    // Create a secure HTTP/2 server
    server = createSecureServer(
      {
        allowHTTP1: false,
        key: keys.serviceKey,
        cert: keys.certificate,
      },
      (request, response) => {
        response.writeHead(200, {
          'Content-Type': 'application/json',
        });
        response.end(JSON.stringify(request.headers));
      },
    );

    await new Promise<void>(resolve => server.listen(0, resolve));
  });
  afterAll(() => {
    server.close();
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
