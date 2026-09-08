---
'@whatwg-node/server': minor
'@whatwg-node/fetch': minor
'@whatwg-node/node-fetch': minor
'@whatwg-node/events': minor
'@whatwg-node/cookie-store': minor
'@whatwg-node/server-plugin-cookies': major
'@whatwg-node/disposablestack': minor
'fetchache': minor
'@whatwg-node/promise-helpers': major
---

Drop support for Node.js 18 and 20. The minimum supported Node.js version is now **22.15**.

### Why

Node.js 18 and 20 are end-of-life and no longer receive security updates. Keeping them in our support matrix forced version-specific workarounds and slowed adoption of newer Node TLS APIs.

The floor is set to **22.15** (not just 22.0) so we can rely on `tls.getCACertificates()`, which landed in Node.js 22.15 / 23.10. That matches the oldest currently supported LTS line (22 Maintenance) while dropping only EOL majors.

### SemVer

- **0.x packages**: minor bump (breaking changes are allowed in minors while major is 0).
- **1.x packages** (`@whatwg-node/promise-helpers`, `@whatwg-node/server-plugin-cookies`): **major** bump, since dropping supported Node versions is a breaking engines change for SemVer `>=1.0.0` consumers.

### What changed

- **`engines.node`**: all published packages now declare `>=22.15.0` (including `@whatwg-node/promise-helpers`, which was still on `>=16`).
- **`@whatwg-node/server`**: removed the Node 18 `setHeaders` workaround (`isNode1x`); `ServerResponse#setHeaders` is used whenever it exists.
- **`@whatwg-node/node-fetch`**: libcurl always loads CAs from `tls.getCACertificates('default')`. The old `NODE_EXTRA_CA_CERTS` / `tls.rootCertificates` fallback path for engines below 22.15 is gone.
- **CI / e2e**: unit matrix is `[22, 24, 26]`; AWS Lambda runtime and Azure Function target moved from Node 20 to Node 22.

If you are still on Node 18 or 20, upgrade to Node.js **22.15+** (or 24 / 26) before installing this release.
