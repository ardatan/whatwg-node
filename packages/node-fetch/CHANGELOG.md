# @whatwg-node/node-fetch

## 0.1.0

### Minor Changes

- [#328](https://github.com/ardatan/whatwg-node/pull/328)
  [`2d6e4aa`](https://github.com/ardatan/whatwg-node/commit/2d6e4aa67fffe2e33eb16b4c30c00f8ea9cf9a9a)
  Thanks [@ardatan](https://github.com/ardatan)! - New Blob ponyfill instead of the slow native one

### Patch Changes

- [#326](https://github.com/ardatan/whatwg-node/pull/326)
  [`94150b3`](https://github.com/ardatan/whatwg-node/commit/94150b3452f06f5671e87f59f8ae63e6e751289c)
  Thanks [@ardatan](https://github.com/ardatan)! - Allow lazy writes from a flushed controller

## 0.0.6

### Patch Changes

- [#318](https://github.com/ardatan/whatwg-node/pull/318)
  [`390510b`](https://github.com/ardatan/whatwg-node/commit/390510b39d5d374233eb9798adbd0ef14101e2b7)
  Thanks [@ardatan](https://github.com/ardatan)! - Small optimizations

## 0.0.5

### Patch Changes

- [#314](https://github.com/ardatan/whatwg-node/pull/314)
  [`3aa1848`](https://github.com/ardatan/whatwg-node/commit/3aa18486d44c507617b25204c3d4a96bc8a4c9e4)
  Thanks [@ardatan](https://github.com/ardatan)! - dependencies updates:

  - Updated dependency
    [`@whatwg-node/events@^0.0.2` ↗︎](https://www.npmjs.com/package/@whatwg-node/events/v/0.0.2)
    (from `0.0.2`, in `dependencies`)
  - Updated dependency [`busboy@^1.6.0` ↗︎](https://www.npmjs.com/package/busboy/v/1.6.0) (from
    `1.6.0`, in `dependencies`)

- [#314](https://github.com/ardatan/whatwg-node/pull/314)
  [`3aa1848`](https://github.com/ardatan/whatwg-node/commit/3aa18486d44c507617b25204c3d4a96bc8a4c9e4)
  Thanks [@ardatan](https://github.com/ardatan)! - Align versions with ranged dependencies and cross
  version support internally

## 0.0.4

### Patch Changes

- [`01dc91e`](https://github.com/ardatan/whatwg-node/commit/01dc91e0db7f65599d9bc018c0a9396dd0e5ad27)
  Thanks [@ardatan](https://github.com/ardatan)! - Use `Buffer.byteLength` instead of
  `String.length` for string inputs

## 0.0.3

### Patch Changes

- [#311](https://github.com/ardatan/whatwg-node/pull/311)
  [`8edd68d`](https://github.com/ardatan/whatwg-node/commit/8edd68d288889e7a1222c8790a708b0930f337e2)
  Thanks [@ardatan](https://github.com/ardatan)! - Performance improvements

- [`b6c9ac0`](https://github.com/ardatan/whatwg-node/commit/b6c9ac0ae8095ded0970be810f63e23fcca65830)
  Thanks [@ardatan](https://github.com/ardatan)! - Relax Node <14.17 for the users don't use Blob

## 0.0.2

### Patch Changes

- [#305](https://github.com/ardatan/whatwg-node/pull/305)
  [`155c354`](https://github.com/ardatan/whatwg-node/commit/155c354aae4179bf233c68fec386e276728a16de)
  Thanks [@ardatan](https://github.com/ardatan)! - Relax `Blob` check in `FormData.set` and
  `FormData.append` to allow other type of `Blob` instances.

- [#301](https://github.com/ardatan/whatwg-node/pull/301)
  [`260d86f`](https://github.com/ardatan/whatwg-node/commit/260d86f50cd1e215b1fe574042da92124636e56b)
  Thanks [@ardatan](https://github.com/ardatan)! - Respect `keepalive` correctly

## 0.0.1

### Patch Changes

- [#154](https://github.com/ardatan/whatwg-node/pull/154)
  [`9f4fe48`](https://github.com/ardatan/whatwg-node/commit/9f4fe489ff1d08d873a2dd26c02abc54da08dc48)
  Thanks [@ardatan](https://github.com/ardatan)! - New Fetch API implementation for Node
