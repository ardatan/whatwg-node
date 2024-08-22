import { promises as fsPromises } from 'fs';
import { createSecureServer, ServerHttp2Session, type Http2SecureServer } from 'http2';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { CertificateCreationResult, createCertificate } from 'pem';
import { fetchPonyfill } from '../src/fetch';

describe('http2', () => {
  if (!globalThis.libcurl || process.env.LEAK_TEST) {
    it('noop', () => {});
    return;
  }
  let server: Http2SecureServer;
  let pemPath: string;
  const oldEnvVar = process.env.NODE_EXTRA_CA_CERTS;
  const sessions = new Set<ServerHttp2Session>();
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
    pemPath = join(tmpdir(), 'test.pem');
    process.env.NODE_EXTRA_CA_CERTS = pemPath;
    await fsPromises.writeFile(pemPath, keys.certificate);
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

    server.on('session', session => {
      sessions.add(session);
    });

    await new Promise<void>(resolve => server.listen(0, resolve));
  });
  afterAll(async () => {
    await fsPromises.unlink(pemPath);
    process.env.NODE_EXTRA_CA_CERTS = oldEnvVar;
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
