---
'@whatwg-node/node-fetch': patch
---

Align libcurl TLS trust with Node's default CA store.

When `tls.getCACertificates` is available (Node.js 22.15+ / 23.10+), the libcurl fetch implementation now loads CAs from `tls.getCACertificates('default')` instead of only reading `NODE_EXTRA_CA_CERTS` / `tls.rootCertificates`. That means custom CAs installed with `tls.setDefaultCACertificates(...)`, plus CAs from `NODE_EXTRA_CA_CERTS` when it was set **before** process start, are honored the same way as Node's built-in `https` client.

On older Node versions (engines still allow `>=18`), behavior is unchanged: `NODE_EXTRA_CA_CERTS` still maps to libcurl `CAINFO`, otherwise the bundled Mozilla roots are used.

If you previously set `NODE_EXTRA_CA_CERTS` at runtime after the process started, prefer `tls.setDefaultCACertificates([...tls.getCACertificates('default'), ...yourCerts])` so both Node TLS and libcurl pick up the same store. That setter requires Node.js 22.19+ / 24.5+ (guard with `typeof tls.setDefaultCACertificates === 'function'` on older versions).
