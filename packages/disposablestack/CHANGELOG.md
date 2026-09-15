# @whatwg-node/disposablestack

## 0.1.0

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

### Patch Changes

- Updated dependencies
  [[`52a5bf6`](https://github.com/ardatan/whatwg-node/commit/52a5bf6922e2daef4705aca524b3d165a6424372),
  [`ba977d4`](https://github.com/ardatan/whatwg-node/commit/ba977d4b0227938aa76913d180730f8317b74a95)]:
  - @whatwg-node/promise-helpers@2.0.0

## 0.0.6

### Patch Changes

- [#2102](https://github.com/ardatan/whatwg-node/pull/2102)
  [`5cf6b2d`](https://github.com/ardatan/whatwg-node/commit/5cf6b2dbc589f4330c5efdee96356f48e438ae9e)
  Thanks [@ardatan](https://github.com/ardatan)! - dependencies updates:
  - Added dependency
    [`@whatwg-node/promise-helpers@^0.0.0` ↗︎](https://www.npmjs.com/package/@whatwg-node/promise-helpers/v/0.0.0)
    (to `dependencies`)
- Updated dependencies
  [[`5cf6b2d`](https://github.com/ardatan/whatwg-node/commit/5cf6b2dbc589f4330c5efdee96356f48e438ae9e)]:
  - @whatwg-node/promise-helpers@1.0.0

## 0.0.5

### Patch Changes

- [`effd12f`](https://github.com/ardatan/whatwg-node/commit/effd12f88e918a5b93ea88b1fc74f6ee05696c58)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix SuppressedError reference

## 0.0.4

### Patch Changes

- [`860bfde`](https://github.com/ardatan/whatwg-node/commit/860bfde7d7b6cf1b090e0b91c48bcb3cac69cb89)
  Thanks [@ardatan](https://github.com/ardatan)! - Ponyfill SuppressedError
  correctly inside DisposableStack ponyfills

## 0.0.3

### Patch Changes

- [`0a49705`](https://github.com/ardatan/whatwg-node/commit/0a4970574738c918913d503223968c68a04186e7)
  Thanks [@ardatan](https://github.com/ardatan)! - Throw SupressedError in
  DisposableStack

## 0.0.2

### Patch Changes

- [`8ab228c`](https://github.com/ardatan/whatwg-node/commit/8ab228cb348ec7e16250c7f530956186311e16d9)
  Thanks [@ardatan](https://github.com/ardatan)! - Improve `disposed` flag and
  cleanup callbacks on AsyncDisposable on disposeAsync call

## 0.0.1

### Patch Changes

- [#1514](https://github.com/ardatan/whatwg-node/pull/1514)
  [`61a0480`](https://github.com/ardatan/whatwg-node/commit/61a0480f1f024b0455598c0c0bd213a74cd72394)
  Thanks [@ardatan](https://github.com/ardatan)! - New ponyfill
