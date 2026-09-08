import type { PeerCertificate } from 'node:tls';
import { describe, expect, it } from '@jest/globals';
import {
  checkServerIdentityIpv6San,
  getHttpsCheckServerIdentity,
  needsIpv6SanWorkaround,
  normalizeIpAddress,
} from '../src/checkServerIdentity';

describe('checkServerIdentity', () => {
  it('normalizes compressed and expanded IPv6 forms', () => {
    expect(normalizeIpAddress('::1')).toBe(normalizeIpAddress('0:0:0:0:0:0:0:1'));
    expect(normalizeIpAddress('[::1]')).toBe(normalizeIpAddress('::1'));
  });

  it('exposes the https override only when the Node probe detects the bug', () => {
    if (needsIpv6SanWorkaround()) {
      expect(getHttpsCheckServerIdentity()).toBe(checkServerIdentityIpv6San);
    } else {
      expect(getHttpsCheckServerIdentity()).toBeUndefined();
    }
  });

  it('accepts IPv6 host when cert lists expanded IP SAN', () => {
    const cert = {
      subject: {},
      subjectaltname: 'DNS:localhost, IP Address:127.0.0.1, IP Address:0:0:0:0:0:0:0:1',
    } as PeerCertificate;
    expect(checkServerIdentityIpv6San('::1', cert)).toBeUndefined();
    expect(checkServerIdentityIpv6San('[::1]', cert)).toBeUndefined();
    expect(checkServerIdentityIpv6San('::1.', cert)).toBeUndefined();
  });

  it('rejects IPv6 host that is not in the cert SAN list', () => {
    const cert = {
      subject: {},
      subjectaltname: 'IP Address:127.0.0.1',
    } as PeerCertificate;
    const error = checkServerIdentityIpv6San('::1', cert);
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain('::1');
  });

  it('still validates DNS names via tls.checkServerIdentity', () => {
    const cert = {
      subject: { CN: 'example.com' },
      subjectaltname: 'DNS:example.com',
    } as PeerCertificate;
    expect(checkServerIdentityIpv6San('example.com', cert)).toBeUndefined();
    expect(checkServerIdentityIpv6San('evil.example', cert)?.message).toMatch(/evil\.example/);
  });
});
