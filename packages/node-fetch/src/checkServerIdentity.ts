import { isIP } from 'node:net';
import tls, { type PeerCertificate } from 'node:tls';

/**
 * Canonicalize an IP for equality checks (`::1` vs `0:0:0:0:0:0:0:1`).
 */
export function normalizeIpAddress(ip: string): string {
  const bare = ip.replace(/^\[|\]$/g, '');
  const family = isIP(bare);
  if (family === 4) {
    return bare;
  }
  if (family === 6) {
    // WHATWG URL hostname normalizes IPv6 to a canonical form.
    return new URL(`http://[${bare}]`).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  }
  return bare.toLowerCase();
}

function collectCertIpAddresses(cert: PeerCertificate): string[] {
  const alt = cert.subjectaltname;
  if (!alt) {
    return [];
  }
  const ips: string[] = [];
  for (const part of alt.split(', ')) {
    if (part.startsWith('IP Address:')) {
      ips.push(part.slice('IP Address:'.length));
    }
  }
  return ips;
}

/**
 * Like `tls.checkServerIdentity`, but correctly matches IPv6 literals against
 * `IP Address` SANs on Node.js versions affected by
 * https://github.com/nodejs/node/issues/64032 (domainToASCII breaks the IP path).
 */
export function checkServerIdentity(hostname: string, cert: PeerCertificate): Error | undefined {
  const bareHost = hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');

  if (isIP(bareHost)) {
    const certIps = collectCertIpAddresses(cert);
    const want = normalizeIpAddress(bareHost);
    if (certIps.some(ip => normalizeIpAddress(ip) === want)) {
      return undefined;
    }
    const reason = `Hostname/IP does not match certificate's altnames: IP: ${bareHost} is not in the cert's list: ${certIps.join(', ')}`;
    const error = new Error(reason) as NodeJS.ErrnoException & {
      reason: string;
      host: string;
      cert: PeerCertificate;
    };
    error.reason = reason;
    error.host = bareHost;
    error.cert = cert;
    error.code = 'ERR_TLS_CERT_ALTNAME_INVALID';
    return error;
  }

  return tls.checkServerIdentity(hostname, cert);
}
