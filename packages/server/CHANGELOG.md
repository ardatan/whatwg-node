# @whatwg-node/server

## 0.5.10

### Patch Changes

- Updated dependencies
  [[`2ce7122`](https://github.com/ardatan/whatwg-node/commit/2ce71227f0cc86644998cad70405048d79c1b104)]:
  - @whatwg-node/fetch@0.6.4

## 0.5.9

### Patch Changes

- [#154](https://github.com/ardatan/whatwg-node/pull/154)
  [`9f4fe48`](https://github.com/ardatan/whatwg-node/commit/9f4fe489ff1d08d873a2dd26c02abc54da08dc48)
  Thanks [@ardatan](https://github.com/ardatan)! - dependencies updates:
  - Removed dependency
    [`@types/node@^18.0.6` ↗︎](https://www.npmjs.com/package/@types/node/v/18.0.6) (from
    `peerDependencies`)
- Updated dependencies
  [[`9f4fe48`](https://github.com/ardatan/whatwg-node/commit/9f4fe489ff1d08d873a2dd26c02abc54da08dc48),
  [`9f4fe48`](https://github.com/ardatan/whatwg-node/commit/9f4fe489ff1d08d873a2dd26c02abc54da08dc48)]:
  - @whatwg-node/fetch@0.6.3

## 0.5.8

### Patch Changes

- [`a8e7184`](https://github.com/ardatan/whatwg-node/commit/a8e7184f7e3f1837a94eee3f01ca2c5a06facc80)
  Thanks [@ardatan](https://github.com/ardatan)! - Handle falsy and non-object additional parameters
  while building the server context correctly

## 0.5.7

### Patch Changes

- [#280](https://github.com/ardatan/whatwg-node/pull/280)
  [`5ee9169`](https://github.com/ardatan/whatwg-node/commit/5ee91691b100397af75c4471e61ca41e47551af9)
  Thanks [@hansottowirtz](https://github.com/hansottowirtz)! - Copy non-enumerable properties to
  server context e.g. CF Workers' env and context

## 0.5.6

### Patch Changes

- Updated dependencies
  [[`802cb96`](https://github.com/ardatan/whatwg-node/commit/802cb9636eddd8e819b80604fc26d40aac92c828)]:
  - @whatwg-node/fetch@0.6.2

## 0.5.5

### Patch Changes

- [`b68dd96`](https://github.com/ardatan/whatwg-node/commit/b68dd964ee54340213371b236b687ab46c1987af)
  Thanks [@ardatan](https://github.com/ardatan)! - Align `waitUntil` signature with the original
  `FetchEvent.waitUntil`

## 0.5.4

### Patch Changes

- [#245](https://github.com/ardatan/whatwg-node/pull/245)
  [`273a30e`](https://github.com/ardatan/whatwg-node/commit/273a30e67bafef2d4acdaac70445c3ced4606ad7)
  Thanks [@ardatan](https://github.com/ardatan)! - Listen for 'close' event to resolve instead of
  'end' callback

## 0.5.3

### Patch Changes

- Updated dependencies
  [[`9752cca`](https://github.com/ardatan/whatwg-node/commit/9752cca54e7636114d87849ca9c7eb9be3d9dba8)]:
  - @whatwg-node/fetch@0.6.1

## 0.5.2

### Patch Changes

- Updated dependencies
  [[`563cfaa`](https://github.com/ardatan/whatwg-node/commit/563cfaaacf8bb0b08371b7f44887321d7e7c472d),
  [`563cfaa`](https://github.com/ardatan/whatwg-node/commit/563cfaaacf8bb0b08371b7f44887321d7e7c472d)]:
  - @whatwg-node/fetch@0.6.0

## 0.5.1

### Patch Changes

- [#234](https://github.com/ardatan/whatwg-node/pull/234)
  [`fba62c4`](https://github.com/ardatan/whatwg-node/commit/fba62c4eeffa4c80d4e1163aa4df8de6f7ae0459)
  Thanks [@enisdenjo](https://github.com/enisdenjo)! - Adapt types for Node http2

- Updated dependencies
  [[`166102f`](https://github.com/ardatan/whatwg-node/commit/166102f6ff52d2197ab7f78c63392b95ebca259c)]:
  - @whatwg-node/fetch@0.5.4

## 0.5.0

### Minor Changes

- [#219](https://github.com/ardatan/whatwg-node/pull/219)
  [`94c6ff3`](https://github.com/ardatan/whatwg-node/commit/94c6ff3ae27fb45acec9b44da411c45e407df0d2)
  Thanks [@ardatan](https://github.com/ardatan)! - Introduce new middlewares;

  - withCORS
  - withErrorHandling

## 0.4.17

### Patch Changes

- [#183](https://github.com/ardatan/whatwg-node/pull/183)
  [`faf2696`](https://github.com/ardatan/whatwg-node/commit/faf269692980b02c3adb39cacaedb3e2ff939a73)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix type conflicts with webworker typing library

## 0.4.16

### Patch Changes

- Updated dependencies
  [[`188ac01`](https://github.com/ardatan/whatwg-node/commit/188ac01dab264ed483dbc3b897e6958b49085922)]:
  - @whatwg-node/fetch@0.5.3

## 0.4.15

### Patch Changes

- Updated dependencies
  [[`3297c87`](https://github.com/ardatan/whatwg-node/commit/3297c87409c3bcf8700dd447d603da657acbd821)]:
  - @whatwg-node/fetch@0.5.2

## 0.4.14

### Patch Changes

- Updated dependencies
  [[`a8a7cfc`](https://github.com/ardatan/whatwg-node/commit/a8a7cfcbb98c5ca8fff3b4a6d8638e9208690b61)]:
  - @whatwg-node/fetch@0.5.1

## 0.4.13

### Patch Changes

- Updated dependencies
  [[`ab5fb52`](https://github.com/ardatan/whatwg-node/commit/ab5fb524753bc7a210b1aaf2e1580566907d4713)]:
  - @whatwg-node/fetch@0.5.0

## 0.4.12

### Patch Changes

- [`608943b`](https://github.com/ardatan/whatwg-node/commit/608943baf289269f9ee40a27e3e0b20810819d10)
  Thanks [@enisdenjo](https://github.com/enisdenjo)! - Calling req.text() before req.json() is not
  necessary for Bun anymore

## 0.4.11

### Patch Changes

- [`e59cbb6`](https://github.com/ardatan/whatwg-node/commit/e59cbb667dfcbdd9c0cf609fd56dbd904ac85cbd)
  Thanks [@ardatan](https://github.com/ardatan)! - Do not patch global Headers if it is native, and
  support URL as a first parameter of `fetch`

- Updated dependencies
  [[`e59cbb6`](https://github.com/ardatan/whatwg-node/commit/e59cbb667dfcbdd9c0cf609fd56dbd904ac85cbd)]:
  - @whatwg-node/fetch@0.4.7

## 0.4.10

### Patch Changes

- [#148](https://github.com/ardatan/whatwg-node/pull/148)
  [`eb10500`](https://github.com/ardatan/whatwg-node/commit/eb105005fd01bd227eff8d52c22b39ea1a8c6700)
  Thanks [@ardatan](https://github.com/ardatan)! - - On Node 14, fix the return method of
  Response.body's AsyncIterator to close HTTP connection correctly

  - On Node 14, handle ReadableStream's cancel correctly if Response.body is a ReadableStream
  - Do not modify ReadableStream.cancel's behavior but handle it internally
  - On Node 18, do not combine Response.body's return and AbortController which causes a memory leak

- [#149](https://github.com/ardatan/whatwg-node/pull/149)
  [`519d42a`](https://github.com/ardatan/whatwg-node/commit/519d42a45ede0ec2f19eb4c8d254c8a3e5fab978)
  Thanks [@ardatan](https://github.com/ardatan)! - Force stop connection after Response.body is done

- Updated dependencies
  [[`c918527`](https://github.com/ardatan/whatwg-node/commit/c918527f15eb6096656376648dccdbc8d6898395),
  [`eb10500`](https://github.com/ardatan/whatwg-node/commit/eb105005fd01bd227eff8d52c22b39ea1a8c6700)]:
  - @whatwg-node/fetch@0.4.6

## 0.4.9

### Patch Changes

- [`5a884ee`](https://github.com/ardatan/whatwg-node/commit/5a884ee23a84c0338919cb5aec0a78f86718feb8)
  Thanks [@ardatan](https://github.com/ardatan)! - Ensure ReadableStream is also cancelled after
  Reader cancelled if Response.body is ReadableStream

## 0.4.8

### Patch Changes

- [#142](https://github.com/ardatan/whatwg-node/pull/142)
  [`a8071f7`](https://github.com/ardatan/whatwg-node/commit/a8071f74fcaa4d429b45b7290c9f3376907c6e83)
  Thanks [@ardatan](https://github.com/ardatan)! - Handle Node requests correctly if Response.body
  is a native ReadableStream

## 0.4.7

### Patch Changes

- [`60672fb`](https://github.com/ardatan/whatwg-node/commit/60672fb0126a1eac058c836c835a554d77e201cd)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix NodeRequest

## 0.4.6

### Patch Changes

- [#134](https://github.com/ardatan/whatwg-node/pull/134)
  [`ed098ba`](https://github.com/ardatan/whatwg-node/commit/ed098ba0769f1ef6fbfa1fc9711955e8b8b04dfd)
  Thanks [@enisdenjo](https://github.com/enisdenjo)! - Improved types

- [#140](https://github.com/ardatan/whatwg-node/pull/140)
  [`5d151df`](https://github.com/ardatan/whatwg-node/commit/5d151df8c59329a470b8ffa6e3547aae72a7e55b)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix Request.formData method

- Updated dependencies
  [[`5d151df`](https://github.com/ardatan/whatwg-node/commit/5d151df8c59329a470b8ffa6e3547aae72a7e55b)]:
  - @whatwg-node/fetch@0.4.5

## 0.4.5

### Patch Changes

- [`16fdfb9`](https://github.com/ardatan/whatwg-node/commit/16fdfb970bde9649eafc97296d527ca22d09b96d)
  Thanks [@ardatan](https://github.com/ardatan)! - Use fixed version of fetch package instead of
  ranged version

## 0.4.4

### Patch Changes

- [`a91ef16`](https://github.com/ardatan/whatwg-node/commit/a91ef167d60465ca27e411f494b72e9c465a989f)
  Thanks [@ardatan](https://github.com/ardatan)! - - Set ServerContext to an empty object by default
  for .fetch method
  - Do not call request handler twice which causes an error `disturbed`

## 0.4.3

### Patch Changes

- [`60a73cc`](https://github.com/ardatan/whatwg-node/commit/60a73cccdeb0c7bdd60e3ddab25d374ac572401a)
  Thanks [@ardatan](https://github.com/ardatan)! - Improve Bun support

## 0.4.2

### Patch Changes

- [`48bdf61`](https://github.com/ardatan/whatwg-node/commit/48bdf61e28d59af9c74a599658f2231d76215cc6)
  Thanks [@ardatan](https://github.com/ardatan)! - Set an empty object if there is no server context
  sent by the environment

## 0.4.1

### Patch Changes

- [`5851d94`](https://github.com/ardatan/whatwg-node/commit/5851d945d37eec9ef7875501080325451e76d8f0)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix accessing base object properties

## 0.4.0

### Minor Changes

- [#121](https://github.com/ardatan/whatwg-node/pull/121)
  [`a67f447`](https://github.com/ardatan/whatwg-node/commit/a67f4473d8510617c19fd750b149b847e6099b07)
  Thanks [@ardatan](https://github.com/ardatan)! - Improvements;

  - `createServerAdapter` can now accept the request handler itself.

  ```ts
  createServerAdapter(req => {
    return new Response(`I got ${req.url}`);
  });
  ```

  Breaking Changes;

  - `baseObject` in the configuration has been removed! Now you can pass `baseObject` itself but
    `baseObject` needs to implement a `handle` method that is exactly same with `handleRequest`.

  ```diff
  - const myServerBaseObject = {...}
  + const myServerBaseObject = {
  +   handle(req) {/*...*/}
  + }

  - const adapter = createServerAdapter({
  -   baseObject: myServerBaseObject,
  -   handleRequest(req) {/*...*/}
  - })
  + const adapter = createServerAdapter(myServerBaseObject)
  ```

  - `handleRequest` has been renamed to `handle` which has the same signature.

  ```diff
  createServerAdapter({
  -   handleRequest(request) {
  +   handle(request) {
  })
  ```

  - `Request` in the configuration needs to be passed as a second argument.

  ```diff
  createServerAdapter({
  -   handleRequest(request) {
  +   handle(request) {
  -   Request: MyRequestCtor
  - })
  + }, MyRequestCtor)
  ```

## 0.3.0

### Minor Changes

- [`722ffda`](https://github.com/ardatan/whatwg-node/commit/722ffda607106cb07378766a6ecc4a10a527eb2c)
  Thanks [@ardatan](https://github.com/ardatan)! - Implement `waitUntil`

## 0.2.0

### Minor Changes

- [`effc03d`](https://github.com/ardatan/whatwg-node/commit/effc03d58793328595183ac7cd5c9abab95dec17)
  Thanks [@ardatan](https://github.com/ardatan)! - Bun Support

### Patch Changes

- Updated dependencies
  [[`005937c`](https://github.com/ardatan/whatwg-node/commit/005937c72749dfa3914c8b6193a88c772a522275),
  [`effc03d`](https://github.com/ardatan/whatwg-node/commit/effc03d58793328595183ac7cd5c9abab95dec17)]:
  - @whatwg-node/fetch@0.4.0

## 0.1.2

### Patch Changes

- Updated dependencies
  [[`8a431d3`](https://github.com/ardatan/whatwg-node/commit/8a431d309271c0d1ff7248ec26afe293ccc01bf6),
  [`8a431d3`](https://github.com/ardatan/whatwg-node/commit/8a431d309271c0d1ff7248ec26afe293ccc01bf6)]:
  - @whatwg-node/fetch@0.3.0

## 0.1.1

### Patch Changes

- [`fd179aa`](https://github.com/ardatan/whatwg-node/commit/fd179aa80451e93ccab6584680e262509feca49b)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix the signature of the server adapter's `fetch`

## 0.1.0

### Minor Changes

- [#78](https://github.com/ardatan/whatwg-node/pull/78)
  [`415b0a5`](https://github.com/ardatan/whatwg-node/commit/415b0a53a266f6be9ebfa4848910e0923e2a3878)
  Thanks [@ardatan](https://github.com/ardatan)! - If `fetch` is called with multiple arguments like
  `fetch(request, env, ctx)` (for example CF Workers do that), the parameters after `request` will
  be merged and passed as a `ServerContext` to the provided `handleRequest` function.

### Patch Changes

- [#78](https://github.com/ardatan/whatwg-node/pull/78)
  [`415b0a5`](https://github.com/ardatan/whatwg-node/commit/415b0a53a266f6be9ebfa4848910e0923e2a3878)
  Thanks [@ardatan](https://github.com/ardatan)! - Since Node 18 starts returning IPv6 in
  `socket.localAddress`, the generated URL was broken like `http://0.0.0.1:3000`. Now it generates
  the URL of `Request` on Node 18 correctly. First we respect `host` header as recommended in
  [Node.js documentation](https://nodejs.org/api/http.html).
- Updated dependencies
  [[`9a8d873`](https://github.com/ardatan/whatwg-node/commit/9a8d8731ff07ea585b1e561718584fbe5edeb963)]:
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

- 6aaa591: Use '.originalUrl' if possible to get `Request.url` properly because some frameworks like
  Express are sending `/` to `url`

## 0.0.2

### Patch Changes

- Updated dependencies [3207383]
  - @whatwg-node/fetch@0.0.2

## 0.0.1

### Patch Changes

- 889eccf: NEW RELEASES
- Updated dependencies [889eccf]
  - @whatwg-node/fetch@0.0.1
