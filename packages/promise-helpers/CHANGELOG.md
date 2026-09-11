# @whatwg-node/promise-helpers

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

- [#3565](https://github.com/ardatan/whatwg-node/pull/3565)
  [`ba977d4`](https://github.com/ardatan/whatwg-node/commit/ba977d4b0227938aa76913d180730f8317b74a95)
  Thanks [@ardatan](https://github.com/ardatan)! - **Breaking Change:** Remove
  deprecated `mapMaybePromise` in favor of `handleMaybePromise`.

  `mapMaybePromise(input, onSuccess, onError?)` is gone. Use
  `handleMaybePromise`, which takes an **input factory** (thunk) instead of a
  bare value so sync throws are handled the same way as promise rejections.

  **Before:**

  ```ts
  import { mapMaybePromise } from "@whatwg-node/promise-helpers";

  const result = mapMaybePromise(
    maybeValue,
    (value) => transform(value),
    (err) => fallback(err),
  );
  ```

  **After:**

  ```ts
  import { handleMaybePromise } from "@whatwg-node/promise-helpers";

  const result = handleMaybePromise(
    () => maybeValue,
    (value) => transform(value),
    (err) => fallback(err),
  );
  ```

  `handleMaybePromise` also accepts an optional fourth `finallyFactory` argument
  if you need cleanup.

## 1.3.2

### Patch Changes

- [#2408](https://github.com/ardatan/whatwg-node/pull/2408)
  [`d86b4f3`](https://github.com/ardatan/whatwg-node/commit/d86b4f3df884709145023bf32bb1022c4a8bb9cb)
  Thanks [@slagiewka](https://github.com/slagiewka)! - Reuse fake promise Symbol

## 1.3.1

### Patch Changes

- [#2276](https://github.com/ardatan/whatwg-node/pull/2276)
  [`6bf6aa0`](https://github.com/ardatan/whatwg-node/commit/6bf6aa0b6d4e0c7524aec55fb666147d0862c9b9)
  Thanks [@andreialecu](https://github.com/andreialecu)! - Fix types by
  replacing `VoidFunction` type to `() => void`

## 1.3.0

### Minor Changes

- [#2152](https://github.com/ardatan/whatwg-node/pull/2152)
  [`54a26bb`](https://github.com/ardatan/whatwg-node/commit/54a26bb5c568fdd43945c0050889c1413ebf9391)
  Thanks [@EmrysMyrddin](https://github.com/EmrysMyrddin)! - Allow to pass a
  finally callback to `handleMaybePromise`

## 1.2.5

### Patch Changes

- [#2182](https://github.com/ardatan/whatwg-node/pull/2182)
  [`a45e929`](https://github.com/ardatan/whatwg-node/commit/a45e9290cdc110392d9175d2780c96ad4fd31727)
  Thanks [@ardatan](https://github.com/ardatan)! - - Name functions in
  `iterateAsync` for more readable traces
  - `fakePromise` accepts `MaybePromise` as an input

## 1.2.4

### Patch Changes

- [`a448fd1`](https://github.com/ardatan/whatwg-node/commit/a448fd130ace70f5c65e8ad5a28846a7af8d9777)
  Thanks [@ardatan](https://github.com/ardatan)! - Do not consider fake promises
  as real promises

## 1.2.3

### Patch Changes

- [#2068](https://github.com/ardatan/whatwg-node/pull/2068)
  [`516bf60`](https://github.com/ardatan/whatwg-node/commit/516bf60b55babd57e1721d404a01c526ec218acf)
  Thanks [@EmrysMyrddin](https://github.com/EmrysMyrddin)! - Fix return type of
  the callback of `iterateAsync`. The callback can actually return `null` or
  `undefined`, the implementation is already handling this case.

## 1.2.2

### Patch Changes

- [#2123](https://github.com/ardatan/whatwg-node/pull/2123)
  [`2ca563a`](https://github.com/ardatan/whatwg-node/commit/2ca563a205d12fa6f0bfe2fec39c838b757f7319)
  Thanks [@ardatan](https://github.com/ardatan)! - Use Node 16 at least to
  prevent breaking change on dependent Tools packages

## 1.2.1

### Patch Changes

- [`a587b3d`](https://github.com/ardatan/whatwg-node/commit/a587b3dd1e8a5791ee01ce90d96d3527e0091f99)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix the termination of the
  loop in `iterateAsync`

## 1.2.0

### Minor Changes

- [`156f85f`](https://github.com/ardatan/whatwg-node/commit/156f85f0de1c43ee62f745132f315f3dc5b9a42b)
  Thanks [@ardatan](https://github.com/ardatan)! - Pass `index` to
  `iterateAsync`

## 1.1.0

### Minor Changes

- [`fae5127`](https://github.com/ardatan/whatwg-node/commit/fae5127a1de3aa76c8b1ff21cba9ce7901d47584)
  Thanks [@ardatan](https://github.com/ardatan)! - Add `iterateAsync`

## 1.0.0

### Major Changes

- [#2102](https://github.com/ardatan/whatwg-node/pull/2102)
  [`5cf6b2d`](https://github.com/ardatan/whatwg-node/commit/5cf6b2dbc589f4330c5efdee96356f48e438ae9e)
  Thanks [@ardatan](https://github.com/ardatan)! - New promise helpers
