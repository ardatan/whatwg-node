# @whatwg-node/node-fetch

## 0.4.12

### Patch Changes

- [#746](https://github.com/ardatan/whatwg-node/pull/746)
  [`4c0b59e`](https://github.com/ardatan/whatwg-node/commit/4c0b59e2a59e4564ff7afd7334ca2ae4f51c020e)
  Thanks [@ardatan](https://github.com/ardatan)! - Fake promises instead of real ones for
  performance optimizations

## 0.4.11

### Patch Changes

- [#706](https://github.com/ardatan/whatwg-node/pull/706)
  [`e6d9f02`](https://github.com/ardatan/whatwg-node/commit/e6d9f029c2846dfeb40c0ad4a0afd2fa2d2d55d1)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix the bug causing the stream hang when the
  response body is empty. Related https://github.com/ardatan/whatwg-node/issues/703

## 0.4.10

### Patch Changes

- [#702](https://github.com/ardatan/whatwg-node/pull/702)
  [`9d90ef1`](https://github.com/ardatan/whatwg-node/commit/9d90ef193b244a3bd26099d501defd6034fc86eb)
  Thanks [@ardatan](https://github.com/ardatan)! - Use `POSTFIELDS` for static results in
  `fetchCurl` to avoid using Node life-cycle whenever possible (Performance optimization)

## 0.4.9

### Patch Changes

- [`1c29ff7`](https://github.com/ardatan/whatwg-node/commit/1c29ff7ac8964b98b2093189f332c341d6cd62a1)
  Thanks [@ardatan](https://github.com/ardatan)! - Use `Curl` instead of `curly` to get better
  performance without any extra logic in JS side

## 0.4.8

### Patch Changes

- [#567](https://github.com/ardatan/whatwg-node/pull/567)
  [`f8715cd`](https://github.com/ardatan/whatwg-node/commit/f8715cd15175e348169a11fd5531b901fec47e62)
  Thanks [@ardatan](https://github.com/ardatan)! - ### Faster HTTP Client experience in Node.js with
  HTTP/2 support

  If you install `node-libcurl` seperately, `@whatwg-node/fetch` will select `libcurl` instead of
  `node:http` which is faster.

  [See benchmarks](https://github.com/JCMais/node-libcurl/tree/develop/benchmark#ubuntu-1910-i7-5500u-24ghz---linux-530-42---node-v12162)

## 0.4.7

### Patch Changes

- [`a1c2140`](https://github.com/ardatan/whatwg-node/commit/a1c2140240388ca11a6f4c7bcec2682c47bdc24d)
  Thanks [@ardatan](https://github.com/ardatan)! - Do not use async iterators to consume incoming
  Readable stream

## 0.4.6

### Patch Changes

- [`124bbe5`](https://github.com/ardatan/whatwg-node/commit/124bbe55f125dc9248fdde9c7e86637d905739fe)
  Thanks [@ardatan](https://github.com/ardatan)! - Implement Headers.getSetCookie and a custom
  serializer for node.inspect

## 0.4.5

### Patch Changes

- [#614](https://github.com/ardatan/whatwg-node/pull/614)
  [`f07d1c5`](https://github.com/ardatan/whatwg-node/commit/f07d1c5af5d17d64a45162a23a755ae8ce11ac93)
  Thanks [@ardatan](https://github.com/ardatan)! - Performance optimizations

## 0.4.4

### Patch Changes

- [#612](https://github.com/ardatan/whatwg-node/pull/612)
  [`273ca94`](https://github.com/ardatan/whatwg-node/commit/273ca94a35e0d4236d932e28f295f405d9adbd4c)
  Thanks [@ardatan](https://github.com/ardatan)! - Performance optimizations

## 0.4.3

### Patch Changes

- [#597](https://github.com/ardatan/whatwg-node/pull/597)
  [`d118d53`](https://github.com/ardatan/whatwg-node/commit/d118d538f3ab75f87728c4c8373b5b53fb8e1d51)
  Thanks [@ardatan](https://github.com/ardatan)! - Performance optimizations

## 0.4.2

### Patch Changes

- [`d7d9d9f`](https://github.com/ardatan/whatwg-node/commit/d7d9d9ff8903126eb3a346d35dcf621cafff1bd8)
  Thanks [@ardatan](https://github.com/ardatan)! - Bump internal packages

## 0.4.1

### Patch Changes

- [#570](https://github.com/ardatan/whatwg-node/pull/570)
  [`b201e60`](https://github.com/ardatan/whatwg-node/commit/b201e60e4624b298ee8c3ec329d6b8cbf75ef8c4)
  Thanks [@ardatan](https://github.com/ardatan)! - Accept custom `agent`

## 0.4.0

### Minor Changes

- [#535](https://github.com/ardatan/whatwg-node/pull/535)
  [`01051f8`](https://github.com/ardatan/whatwg-node/commit/01051f8b3408ac26612b8d8ea2702a3f7e6667af)
  Thanks [@ardatan](https://github.com/ardatan)! - Drop Node 14 support

### Patch Changes

- Updated dependencies
  [[`01051f8`](https://github.com/ardatan/whatwg-node/commit/01051f8b3408ac26612b8d8ea2702a3f7e6667af)]:
  - @whatwg-node/events@0.1.0

## 0.3.6

### Patch Changes

- [#492](https://github.com/ardatan/whatwg-node/pull/492)
  [`f3ce0e8`](https://github.com/ardatan/whatwg-node/commit/f3ce0e815f6085d199590359a39048c39920e6ce)
  Thanks [@renovate](https://github.com/apps/renovate)! - Add missing `size` property of
  `URLSearchParams`

- Updated dependencies
  [[`e8bda7c`](https://github.com/ardatan/whatwg-node/commit/e8bda7cdf440a7f4bb617ee1b5df8ee1becb4ad6)]:
  - @whatwg-node/events@0.0.3

## 0.3.5

### Patch Changes

- [#482](https://github.com/ardatan/whatwg-node/pull/482)
  [`7e4237e`](https://github.com/ardatan/whatwg-node/commit/7e4237eff499abe11d38732edef2db3230922356)
  Thanks [@ardatan](https://github.com/ardatan)! - Allow custom header serializer

## 0.3.4

### Patch Changes

- [`d1e2043`](https://github.com/ardatan/whatwg-node/commit/d1e2043b88e5bb62fd9507cc9169dc74f45fd1b1)
  Thanks [@ardatan](https://github.com/ardatan)! - Remove @types/node peer dependency

## 0.3.3

### Patch Changes

- [#434](https://github.com/ardatan/whatwg-node/pull/434)
  [`9f242f8`](https://github.com/ardatan/whatwg-node/commit/9f242f8268748345899ea4b6f05dac3c6dcecbeb)
  Thanks [@ardatan](https://github.com/ardatan)! - Update bob

- [`bf585a3`](https://github.com/ardatan/whatwg-node/commit/bf585a3b1cafa63bdee86dace6a0e08f98a9b554)
  Thanks [@ardatan](https://github.com/ardatan)! - Support iterable Fetch API methods

## 0.3.2

### Patch Changes

- [`40dd7b5`](https://github.com/ardatan/whatwg-node/commit/40dd7b51181badf4e31edb53a481d52bc6fdb416)
  Thanks [@ardatan](https://github.com/ardatan)! - Support compression content encodings like zlib,
  gzip, deflate, br, etc. in Node.js

## 0.3.1

### Patch Changes

- [#380](https://github.com/ardatan/whatwg-node/pull/380)
  [`0df1ac7`](https://github.com/ardatan/whatwg-node/commit/0df1ac7d577ba831ce6431d68628b2028c37762f)
  Thanks [@ardatan](https://github.com/ardatan)! - Choose the correct status text for the given
  status code if not provided by the user

## 0.3.0

### Minor Changes

- [`c7b9c8a`](https://github.com/ardatan/whatwg-node/commit/c7b9c8a4f58926e923bb3f581cf145feb389880f)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix handling search parameters

### Patch Changes

- [`f28ce1f`](https://github.com/ardatan/whatwg-node/commit/f28ce1f11c888187869a6c4df55f6438dc0eaab6)
  Thanks [@ardatan](https://github.com/ardatan)! - No need to use Blob for consuming text streams

## 0.2.0

### Minor Changes

- [`ea5d252`](https://github.com/ardatan/whatwg-node/commit/ea5d25298c480d4c5483186af41dccda8197164d)
  Thanks [@ardatan](https://github.com/ardatan)! - New URL and URLSearchParams ponyfills

### Patch Changes

- [`ea5d252`](https://github.com/ardatan/whatwg-node/commit/ea5d25298c480d4c5483186af41dccda8197164d)
  Thanks [@ardatan](https://github.com/ardatan)! - dependencies updates:

  - Added dependency
    [`fast-querystring@^1.1.1` ↗︎](https://www.npmjs.com/package/fast-querystring/v/1.1.1) (to
    `dependencies`)
  - Added dependency
    [`fast-url-parser@^1.1.3` ↗︎](https://www.npmjs.com/package/fast-url-parser/v/1.1.3) (to
    `dependencies`)

- [#331](https://github.com/ardatan/whatwg-node/pull/331)
  [`ebfbb84`](https://github.com/ardatan/whatwg-node/commit/ebfbb845be1a9f3893f62c850554cf6162f3b6d7)
  Thanks [@ardatan](https://github.com/ardatan)! - Performance improvements

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
