import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface EphemeralTlsCerts {
  /** Trust anchor to install in the client CA store. */
  caCert: string;
  /** Server private key (PEM). */
  serviceKey: string;
  /** Server leaf certificate signed by `caCert` (PEM). */
  certificate: string;
}

/**
 * Create an ephemeral test CA + localhost leaf via OpenSSL.
 * Avoids the `pem` package and produces a proper CA:FALSE leaf with SAN.
 */
export async function createEphemeralTlsCerts(
  commonName = 'localhost',
): Promise<EphemeralTlsCerts> {
  const dir = await mkdtemp(join(tmpdir(), 'whatwg-node-tls-'));
  const caKeyPath = join(dir, 'ca-key.pem');
  const caCertPath = join(dir, 'ca-cert.pem');
  const leafKeyPath = join(dir, 'leaf-key.pem');
  const leafCsrPath = join(dir, 'leaf.csr');
  const leafCertPath = join(dir, 'leaf-cert.pem');
  const extPath = join(dir, 'leaf-ext.cnf');

  try {
    await writeFile(
      extPath,
      [
        'basicConstraints=critical,CA:FALSE',
        'keyUsage=critical,digitalSignature,keyEncipherment',
        'extendedKeyUsage=serverAuth',
        `subjectAltName=DNS:${commonName},DNS:localhost,IP:127.0.0.1`,
      ].join('\n'),
    );

    await execFileAsync('openssl', [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      caKeyPath,
      '-out',
      caCertPath,
      '-days',
      '1',
      '-subj',
      '/CN=whatwg-node-test-ca',
    ]);

    await execFileAsync('openssl', [
      'req',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      leafKeyPath,
      '-out',
      leafCsrPath,
      '-subj',
      `/CN=${commonName}`,
    ]);

    await execFileAsync('openssl', [
      'x509',
      '-req',
      '-in',
      leafCsrPath,
      '-CA',
      caCertPath,
      '-CAkey',
      caKeyPath,
      '-CAcreateserial',
      '-out',
      leafCertPath,
      '-days',
      '1',
      '-extfile',
      extPath,
    ]);

    const [caCert, serviceKey, certificate] = await Promise.all([
      readFile(caCertPath, 'utf8'),
      readFile(leafKeyPath, 'utf8'),
      readFile(leafCertPath, 'utf8'),
    ]);

    return { caCert, serviceKey, certificate };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
