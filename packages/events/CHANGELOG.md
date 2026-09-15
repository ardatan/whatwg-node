# @whatwg-node/events

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

## 0.1.2

### Patch Changes

- [#1514](https://github.com/ardatan/whatwg-node/pull/1514)
  [`61a0480`](https://github.com/ardatan/whatwg-node/commit/61a0480f1f024b0455598c0c0bd213a74cd72394)
  Thanks [@ardatan](https://github.com/ardatan)! - dependencies updates:
  - Added dependency
    [`tslib@^2.6.3` ↗︎](https://www.npmjs.com/package/tslib/v/2.6.3) (to
    `dependencies`)

## 0.1.1

### Patch Changes

- [#554](https://github.com/ardatan/whatwg-node/pull/554)
  [`dc29e24`](https://github.com/ardatan/whatwg-node/commit/dc29e24a27921a39a8a3009f9fe32f5c8e6b3b50)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Follow the spec and set
  `detail` to null by default

## 0.1.0

### Minor Changes

- [#535](https://github.com/ardatan/whatwg-node/pull/535)
  [`01051f8`](https://github.com/ardatan/whatwg-node/commit/01051f8b3408ac26612b8d8ea2702a3f7e6667af)
  Thanks [@ardatan](https://github.com/ardatan)! - Drop Node 14 support

## 0.0.3

### Patch Changes

- [#427](https://github.com/ardatan/whatwg-node/pull/427)
  [`e8bda7c`](https://github.com/ardatan/whatwg-node/commit/e8bda7cdf440a7f4bb617ee1b5df8ee1becb4ad6)
  Thanks [@Rugvip](https://github.com/Rugvip)! - Restructure type declarations
  to avoid polluting global namespace.

## 0.0.2

### Patch Changes

- [`c0d5c43`](https://github.com/ardatan/whatwg-node/commit/c0d5c43a1c4d3d9fcdf542472fabdebd5118fe23)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix dispatchEvent on Node 14

## 0.0.1

### Patch Changes

- [`9502102`](https://github.com/ardatan/whatwg-node/commit/9502102b265945b37ee38b276ec1533fae0f308f)
  Thanks [@ardatan](https://github.com/ardatan)! - New Event API ponyfill
