# fetchache

## 0.2.0

### Minor Changes

- [#3561](https://github.com/ardatan/whatwg-node/pull/3561)
  [`52a5bf6`](https://github.com/ardatan/whatwg-node/commit/52a5bf6922e2daef4705aca524b3d165a6424372)
  Thanks [@ardatan](https://github.com/ardatan)! - Drop support for Node.js 18
  and 20. The minimum supported Node.js version is now **22.15**.

  ### Why

  Node.js 18 and 20 are end-of-life and no longer receive security updates.
  Keeping them in our support matrix forced version-specific workarounds and
  slowed adoption of newer Node TLS APIs.

  The floor is set to **22.15** (not just 22.0) so we can rely on
  `tls.getCACertificates()`, which landed in Node.js 22.15 / 23.10. That matches
  the oldest currently supported LTS line (22 Maintenance) while dropping only
  EOL majors.

  ### SemVer

  - **0.x packages**: minor bump (breaking changes are allowed in minors while
    major is 0).
  - **1.x packages** (`@whatwg-node/promise-helpers`,
    `@whatwg-node/server-plugin-cookies`): **major** bump, since dropping
    supported Node versions is a breaking engines change for SemVer `>=1.0.0`
    consumers.

  ### What changed

  - **`engines.node`**: all published packages now declare `>=22.15.0`
    (including `@whatwg-node/promise-helpers`, which was still on `>=16`).
  - **`@whatwg-node/server`**: removed the Node 18 `setHeaders` workaround
    (`isNode1x`); `ServerResponse#setHeaders` is used whenever it exists.
  - **`@whatwg-node/node-fetch`**: libcurl always loads CAs from
    `tls.getCACertificates('default')`. The old `NODE_EXTRA_CA_CERTS` /
    `tls.rootCertificates` fallback path for engines below 22.15 is gone.
  - **CI / e2e**: unit matrix is `[22, 24, 26]`; AWS Lambda runtime and Azure
    Function target moved from Node 20 to Node 22.

  If you are still on Node 18 or 20, upgrade to Node.js **22.15+** (or 24 / 26)
  before installing this release.

## 0.1.6

### Patch Changes

- [`145e46e`](https://github.com/ardatan/whatwg-node/commit/145e46e8d11ddfddb3fbb5335a1a959cc63c0eba)
  Thanks [@ardatan](https://github.com/ardatan)! - Implement `.bytes` method for
  `Blob` and `Body`, now `Uint8Array` is available with `bytes` format

## 0.1.5

### Patch Changes

- [#434](https://github.com/ardatan/whatwg-node/pull/434)
  [`9f242f8`](https://github.com/ardatan/whatwg-node/commit/9f242f8268748345899ea4b6f05dac3c6dcecbeb)
  Thanks [@ardatan](https://github.com/ardatan)! - Update bob

## 0.1.4

### Patch Changes

- [`f1db96f`](https://github.com/ardatan/whatwg-node/commit/f1db96fdd4988a1384ddefa2b7d148b128ee8f97)
  Thanks [@ardatan](https://github.com/ardatan)! - Respect additional parameters
  to fetch

## 0.1.3

### Patch Changes

- [#104](https://github.com/ardatan/whatwg-node/pull/104)
  [`7093734`](https://github.com/ardatan/whatwg-node/commit/70937343d07bbfbbd56fdf44b8f143c9bcbc5c03)
  Thanks [@ardatan](https://github.com/ardatan)! - Avoid using Request
  constructor

## 0.1.2

### Patch Changes

- 1e8d9d5: fix(fetchache): support binary responses
