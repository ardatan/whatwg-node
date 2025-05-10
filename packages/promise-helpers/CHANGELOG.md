# @whatwg-node/promise-helpers

## 1.3.2

### Patch Changes

- [#2408](https://github.com/ardatan/whatwg-node/pull/2408)
  [`d86b4f3`](https://github.com/ardatan/whatwg-node/commit/d86b4f3df884709145023bf32bb1022c4a8bb9cb)
  Thanks [@slagiewka](https://github.com/slagiewka)! - Reuse fake promise Symbol

## 1.3.1

### Patch Changes

- [#2276](https://github.com/ardatan/whatwg-node/pull/2276)
  [`6bf6aa0`](https://github.com/ardatan/whatwg-node/commit/6bf6aa0b6d4e0c7524aec55fb666147d0862c9b9)
  Thanks [@andreialecu](https://github.com/andreialecu)! - Fix types by replacing `VoidFunction`
  type to `() => void`

## 1.3.0

### Minor Changes

- [#2152](https://github.com/ardatan/whatwg-node/pull/2152)
  [`54a26bb`](https://github.com/ardatan/whatwg-node/commit/54a26bb5c568fdd43945c0050889c1413ebf9391)
  Thanks [@EmrysMyrddin](https://github.com/EmrysMyrddin)! - Allow to pass a finally callback to
  `handleMaybePromise`

## 1.2.5

### Patch Changes

- [#2182](https://github.com/ardatan/whatwg-node/pull/2182)
  [`a45e929`](https://github.com/ardatan/whatwg-node/commit/a45e9290cdc110392d9175d2780c96ad4fd31727)
  Thanks [@ardatan](https://github.com/ardatan)! - - Name functions in `iterateAsync` for more
  readable traces
  - `fakePromise` accepts `MaybePromise` as an input

## 1.2.4

### Patch Changes

- [`a448fd1`](https://github.com/ardatan/whatwg-node/commit/a448fd130ace70f5c65e8ad5a28846a7af8d9777)
  Thanks [@ardatan](https://github.com/ardatan)! - Do not consider fake promises as real promises

## 1.2.3

### Patch Changes

- [#2068](https://github.com/ardatan/whatwg-node/pull/2068)
  [`516bf60`](https://github.com/ardatan/whatwg-node/commit/516bf60b55babd57e1721d404a01c526ec218acf)
  Thanks [@EmrysMyrddin](https://github.com/EmrysMyrddin)! - Fix return type of the callback of
  `iterateAsync`. The callback can actually return `null` or `undefined`, the implementation is
  already handling this case.

## 1.2.2

### Patch Changes

- [#2123](https://github.com/ardatan/whatwg-node/pull/2123)
  [`2ca563a`](https://github.com/ardatan/whatwg-node/commit/2ca563a205d12fa6f0bfe2fec39c838b757f7319)
  Thanks [@ardatan](https://github.com/ardatan)! - Use Node 16 at least to prevent breaking change
  on dependent Tools packages

## 1.2.1

### Patch Changes

- [`a587b3d`](https://github.com/ardatan/whatwg-node/commit/a587b3dd1e8a5791ee01ce90d96d3527e0091f99)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix the termination of the loop in `iterateAsync`

## 1.2.0

### Minor Changes

- [`156f85f`](https://github.com/ardatan/whatwg-node/commit/156f85f0de1c43ee62f745132f315f3dc5b9a42b)
  Thanks [@ardatan](https://github.com/ardatan)! - Pass `index` to `iterateAsync`

## 1.1.0

### Minor Changes

- [`fae5127`](https://github.com/ardatan/whatwg-node/commit/fae5127a1de3aa76c8b1ff21cba9ce7901d47584)
  Thanks [@ardatan](https://github.com/ardatan)! - Add `iterateAsync`

## 1.0.0

### Major Changes

- [#2102](https://github.com/ardatan/whatwg-node/pull/2102)
  [`5cf6b2d`](https://github.com/ardatan/whatwg-node/commit/5cf6b2dbc589f4330c5efdee96356f48e438ae9e)
  Thanks [@ardatan](https://github.com/ardatan)! - New promise helpers
