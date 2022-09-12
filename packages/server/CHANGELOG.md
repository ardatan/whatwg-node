# @whatwg-node/server

## 0.3.0

### Minor Changes

- [`722ffda`](https://github.com/ardatan/whatwg-node/commit/722ffda607106cb07378766a6ecc4a10a527eb2c) Thanks [@ardatan](https://github.com/ardatan)! - Implement `waitUntil`

## 0.2.0

### Minor Changes

- [`effc03d`](https://github.com/ardatan/whatwg-node/commit/effc03d58793328595183ac7cd5c9abab95dec17) Thanks [@ardatan](https://github.com/ardatan)! - Bun Support

### Patch Changes

- Updated dependencies [[`005937c`](https://github.com/ardatan/whatwg-node/commit/005937c72749dfa3914c8b6193a88c772a522275), [`effc03d`](https://github.com/ardatan/whatwg-node/commit/effc03d58793328595183ac7cd5c9abab95dec17)]:
  - @whatwg-node/fetch@0.4.0

## 0.1.2

### Patch Changes

- Updated dependencies [[`8a431d3`](https://github.com/ardatan/whatwg-node/commit/8a431d309271c0d1ff7248ec26afe293ccc01bf6), [`8a431d3`](https://github.com/ardatan/whatwg-node/commit/8a431d309271c0d1ff7248ec26afe293ccc01bf6)]:
  - @whatwg-node/fetch@0.3.0

## 0.1.1

### Patch Changes

- [`fd179aa`](https://github.com/ardatan/whatwg-node/commit/fd179aa80451e93ccab6584680e262509feca49b) Thanks [@ardatan](https://github.com/ardatan)! - Fix the signature of the server adapter's `fetch`

## 0.1.0

### Minor Changes

- [#78](https://github.com/ardatan/whatwg-node/pull/78) [`415b0a5`](https://github.com/ardatan/whatwg-node/commit/415b0a53a266f6be9ebfa4848910e0923e2a3878) Thanks [@ardatan](https://github.com/ardatan)! - If `fetch` is called with multiple arguments like `fetch(request, env, ctx)` (for example CF Workers do that),
  the parameters after `request` will be merged and passed as a `ServerContext` to the provided `handleRequest` function.

### Patch Changes

- [#78](https://github.com/ardatan/whatwg-node/pull/78) [`415b0a5`](https://github.com/ardatan/whatwg-node/commit/415b0a53a266f6be9ebfa4848910e0923e2a3878) Thanks [@ardatan](https://github.com/ardatan)! - Since Node 18 starts returning IPv6 in `socket.localAddress`, the generated URL was broken like `http://0.0.0.1:3000`.
  Now it generates the URL of `Request` on Node 18 correctly. First we respect `host` header as recommended in [Node.js documentation](https://nodejs.org/api/http.html).
- Updated dependencies [[`9a8d873`](https://github.com/ardatan/whatwg-node/commit/9a8d8731ff07ea585b1e561718584fbe5edeb963)]:
  - @whatwg-node/fetch@0.2.9

## 0.0.6

### Patch Changes

- 310c21a: Use "webworker" reference for "FetchEvent" type

## 0.0.5

### Patch Changes

- Updated dependencies [486c35d]
  - @whatwg-node/fetch@0.2.0

## 0.0.4

### Patch Changes

- Updated dependencies [b83d7f3]
- Updated dependencies [b83d7f3]
- Updated dependencies [b83d7f3]
- Updated dependencies [b83d7f3]
  - @whatwg-node/fetch@0.1.0

## 0.0.3

### Patch Changes

- 6aaa591: Use '.originalUrl' if possible to get `Request.url` properly because some frameworks like Express are sending `/` to `url`

## 0.0.2

### Patch Changes

- Updated dependencies [3207383]
  - @whatwg-node/fetch@0.0.2

## 0.0.1

### Patch Changes

- 889eccf: NEW RELEASES
- Updated dependencies [889eccf]
  - @whatwg-node/fetch@0.0.1
