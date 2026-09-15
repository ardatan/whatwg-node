# @whatwg-node/server-plugin-cookies

## 2.0.0

### Major Changes

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
  [[`205d949`](https://github.com/ardatan/whatwg-node/commit/205d949ae0e80ff96f4363f021ae63e344ee1e54),
  [`52a5bf6`](https://github.com/ardatan/whatwg-node/commit/52a5bf6922e2daef4705aca524b3d165a6424372),
  [`36ef02b`](https://github.com/ardatan/whatwg-node/commit/36ef02b4a3b9ee9a0f5b3a6ede66aaceb91caec6),
  [`3e55abc`](https://github.com/ardatan/whatwg-node/commit/3e55abcd6c5c8a0df4a58e0fb76622928de711b0),
  [`b4c83ab`](https://github.com/ardatan/whatwg-node/commit/b4c83abec3571d99672253596e7f78cf26e0e6e7)]:
  - @whatwg-node/server@0.12.0
  - @whatwg-node/cookie-store@0.3.0

## 1.0.7

### Patch Changes

- [#3402](https://github.com/ardatan/whatwg-node/pull/3402)
  [`bb195f8`](https://github.com/ardatan/whatwg-node/commit/bb195f851e09712bda2a20462f464ebbe8ca513e)
  Thanks [@enisdenjo](https://github.com/enisdenjo)! - dependencies updates:
  - Removed dependency
    [`@whatwg-node/server@^0.11.0` ↗︎](https://www.npmjs.com/package/@whatwg-node/server/v/0.11.0)
    (from `dependencies`)
  - Added dependency
    [`@whatwg-node/server@^0.10.0 || ^0.11.0` ↗︎](https://www.npmjs.com/package/@whatwg-node/server/v/0.10.0)
    (to `peerDependencies`)

- [#3402](https://github.com/ardatan/whatwg-node/pull/3402)
  [`bb195f8`](https://github.com/ardatan/whatwg-node/commit/bb195f851e09712bda2a20462f464ebbe8ca513e)
  Thanks [@enisdenjo](https://github.com/enisdenjo)! - @whatwg-node/server is a
  peer dependency

## 1.0.6

### Patch Changes

- Updated dependencies
  [[`228b517`](https://github.com/ardatan/whatwg-node/commit/228b517da8493c4410dfaf9662deca910b9d34b0),
  [`9d02fd0`](https://github.com/ardatan/whatwg-node/commit/9d02fd0ece043eac68fafa8430473844338eb835)]:
  - @whatwg-node/server@0.11.0

## 1.0.5

### Patch Changes

- Updated dependencies
  [[`516bf60`](https://github.com/ardatan/whatwg-node/commit/516bf60b55babd57e1721d404a01c526ec218acf),
  [`516bf60`](https://github.com/ardatan/whatwg-node/commit/516bf60b55babd57e1721d404a01c526ec218acf)]:
  - @whatwg-node/server@0.10.0

## 1.0.4

### Patch Changes

- [#2082](https://github.com/ardatan/whatwg-node/pull/2082)
  [`b217e30`](https://github.com/ardatan/whatwg-node/commit/b217e305b5a5d63e164cf83ef45e7d1e95fefa0e)
  Thanks [@ardatan](https://github.com/ardatan)! - dependencies updates:
  - Updated dependency
    [`@whatwg-node/cookie-store@^0.2.2` ↗︎](https://www.npmjs.com/package/@whatwg-node/cookie-store/v/0.2.2)
    (from `0.2.2`, in `dependencies`)
  - Added dependency
    [`@whatwg-node/server@^0.9.67` ↗︎](https://www.npmjs.com/package/@whatwg-node/server/v/0.9.67)
    (to `dependencies`)
  - Removed dependency
    [`@whatwg-node/server@^0.9.44` ↗︎](https://www.npmjs.com/package/@whatwg-node/server/v/0.9.44)
    (from `peerDependencies`)
- Updated dependencies
  [[`b217e30`](https://github.com/ardatan/whatwg-node/commit/b217e305b5a5d63e164cf83ef45e7d1e95fefa0e)]:
  - @whatwg-node/server@0.9.68

## 1.0.3

### Patch Changes

- [#1495](https://github.com/ardatan/whatwg-node/pull/1495)
  [`bebc159`](https://github.com/ardatan/whatwg-node/commit/bebc159e0a470a0ea89a8575f620ead3f1b6b594)
  Thanks [@ardatan](https://github.com/ardatan)! - Implement
  \`CompressionStream\`, \`WritableStream\` and \`TransformStream\`

- Updated dependencies
  [[`bebc159`](https://github.com/ardatan/whatwg-node/commit/bebc159e0a470a0ea89a8575f620ead3f1b6b594)]:
  - @whatwg-node/server@0.9.44

## 1.0.2

### Patch Changes

- Updated dependencies
  [[`265aab1`](https://github.com/ardatan/whatwg-node/commit/265aab1ac3a1726d8e655060e6cbd22b8ff7d76d)]:
  - @whatwg-node/cookie-store@0.2.2

## 1.0.1

### Patch Changes

- Updated dependencies
  [[`08a9ae5`](https://github.com/ardatan/whatwg-node/commit/08a9ae5f675c7860b6a38ef02ea41390a4c75608)]:
  - @whatwg-node/cookie-store@0.2.1

## 1.0.0

### Patch Changes

- Updated dependencies
  [[`124bbe5`](https://github.com/ardatan/whatwg-node/commit/124bbe55f125dc9248fdde9c7e86637d905739fe)]:
  - @whatwg-node/server@0.9.0

## 0.0.8

### Patch Changes

- [`025613a`](https://github.com/ardatan/whatwg-node/commit/025613af57695c2158189156479129a461d758ce)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix cookie handling

- Updated dependencies
  [[`025613a`](https://github.com/ardatan/whatwg-node/commit/025613af57695c2158189156479129a461d758ce)]:
  - @whatwg-node/cookie-store@0.2.0
  - @whatwg-node/server@0.8.12

## 0.0.7

### Patch Changes

- Updated dependencies
  [[`01051f8`](https://github.com/ardatan/whatwg-node/commit/01051f8b3408ac26612b8d8ea2702a3f7e6667af),
  [`01051f8`](https://github.com/ardatan/whatwg-node/commit/01051f8b3408ac26612b8d8ea2702a3f7e6667af)]:
  - @whatwg-node/cookie-store@0.1.0
  - @whatwg-node/server@0.7.6

## 0.0.6

### Patch Changes

- [`503627f`](https://github.com/ardatan/whatwg-node/commit/503627f67e44395ec0050c2877427aa2f706ff3f)
  Thanks [@ardatan](https://github.com/ardatan)! - Do not set set-cookie header
  if no cookie is set

## 0.0.5

### Patch Changes

- [#500](https://github.com/ardatan/whatwg-node/pull/500)
  [`2896da0`](https://github.com/ardatan/whatwg-node/commit/2896da0d524e1e42e16272f64c055fb868c2e41c)
  Thanks [@ardatan](https://github.com/ardatan)! - dependencies updates:
  - Added dependency
    [`@whatwg-node/cookie-store@0.0.0` ↗︎](https://www.npmjs.com/package/@whatwg-node/cookie-store/v/0.0.0)
    (to `dependencies`)
  - Removed dependency
    [`@whatwg-node/events@^0.0.3` ↗︎](https://www.npmjs.com/package/@whatwg-node/events/v/0.0.3)
    (from `dependencies`)

- [#500](https://github.com/ardatan/whatwg-node/pull/500)
  [`2896da0`](https://github.com/ardatan/whatwg-node/commit/2896da0d524e1e42e16272f64c055fb868c2e41c)
  Thanks [@ardatan](https://github.com/ardatan)! - New CookieStore package

- Updated dependencies
  [[`2896da0`](https://github.com/ardatan/whatwg-node/commit/2896da0d524e1e42e16272f64c055fb868c2e41c)]:
  - @whatwg-node/cookie-store@0.0.1

## 0.0.4

### Patch Changes

- Updated dependencies
  [[`e8bda7c`](https://github.com/ardatan/whatwg-node/commit/e8bda7cdf440a7f4bb617ee1b5df8ee1becb4ad6)]:
  - @whatwg-node/events@0.0.3

## 0.0.3

### Patch Changes

- [`c1875b7`](https://github.com/ardatan/whatwg-node/commit/c1875b7a4f6b456a1f94e3d73a3286ad8cd000c0)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix setting multiple cookies

## 0.0.2

### Patch Changes

- [#434](https://github.com/ardatan/whatwg-node/pull/434)
  [`9f242f8`](https://github.com/ardatan/whatwg-node/commit/9f242f8268748345899ea4b6f05dac3c6dcecbeb)
  Thanks [@ardatan](https://github.com/ardatan)! - Update bob

- Updated dependencies
  [[`9f242f8`](https://github.com/ardatan/whatwg-node/commit/9f242f8268748345899ea4b6f05dac3c6dcecbeb)]:
  - @whatwg-node/server@0.7.5

## 0.0.1

### Patch Changes

- [`20d249c`](https://github.com/ardatan/whatwg-node/commit/20d249c0058ebadde12e46fbf62d4318b627099d)
  Thanks [@ardatan](https://github.com/ardatan)! - Support older versions of
  Node
