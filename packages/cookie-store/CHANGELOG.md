# @whatwg-node/cookie-store

## 0.3.0

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

## 0.2.3

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

## 0.2.2

### Patch Changes

- [#727](https://github.com/ardatan/whatwg-node/pull/727)
  [`265aab1`](https://github.com/ardatan/whatwg-node/commit/265aab1ac3a1726d8e655060e6cbd22b8ff7d76d)
  Thanks [@GauBen](https://github.com/GauBen)! - Added missing .js extension to
  import (#726)

## 0.2.1

### Patch Changes

- [#671](https://github.com/ardatan/whatwg-node/pull/671)
  [`08a9ae5`](https://github.com/ardatan/whatwg-node/commit/08a9ae5f675c7860b6a38ef02ea41390a4c75608)
  Thanks [@EmrysMyrddin](https://github.com/EmrysMyrddin)! - add HttpOnly
  attribute

## 0.2.0

### Minor Changes

- [`025613a`](https://github.com/ardatan/whatwg-node/commit/025613af57695c2158189156479129a461d758ce)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix cookie handling

## 0.1.0

### Minor Changes

- [#535](https://github.com/ardatan/whatwg-node/pull/535)
  [`01051f8`](https://github.com/ardatan/whatwg-node/commit/01051f8b3408ac26612b8d8ea2702a3f7e6667af)
  Thanks [@ardatan](https://github.com/ardatan)! - Drop Node 14 support

### Patch Changes

- [#535](https://github.com/ardatan/whatwg-node/pull/535)
  [`01051f8`](https://github.com/ardatan/whatwg-node/commit/01051f8b3408ac26612b8d8ea2702a3f7e6667af)
  Thanks [@ardatan](https://github.com/ardatan)! - dependencies updates:
  - Removed dependency
    [`@whatwg-node/events@^0.0.3` ↗︎](https://www.npmjs.com/package/@whatwg-node/events/v/0.0.3)
    (from `dependencies`)

## 0.0.1

### Patch Changes

- [#500](https://github.com/ardatan/whatwg-node/pull/500)
  [`2896da0`](https://github.com/ardatan/whatwg-node/commit/2896da0d524e1e42e16272f64c055fb868c2e41c)
  Thanks [@ardatan](https://github.com/ardatan)! - New CookieStore package
