# @whatwg-node/node-fetch

## 0.7.21

### Patch Changes

- [#2424](https://github.com/ardatan/whatwg-node/pull/2424)
  [`28c4ad9`](https://github.com/ardatan/whatwg-node/commit/28c4ad98aad3ec95a1f0893c54f5484d8564f675)
  Thanks [@ardatan](https://github.com/ardatan)! - Performance optimizations

  - Avoid creating `AbortController` and `AbortSignal` if not needed with `new Request` because it
    is expensive
  - Avoid creating a map for `Headers` and try to re-use the init object for `Headers` for
    performance with a single-line `writeHead`.
  - Avoid creating `Buffer` for `string` bodies for performance
  - Use `setHeaders` which accepts `Headers` since Node 18 if needed to forward `Headers` to Node

## 0.7.20

### Patch Changes

- [#2414](https://github.com/ardatan/whatwg-node/pull/2414)
  [`1f0b643`](https://github.com/ardatan/whatwg-node/commit/1f0b64388d64d70c3514771eafaf3fe74e1a2abb)
  Thanks [@ardatan](https://github.com/ardatan)! - Improvements for Node 24 and use `once` from
  `node:events` for Promise-based event handling whenever possible

## 0.7.19

### Patch Changes

- [#2383](https://github.com/ardatan/whatwg-node/pull/2383)
  [`9527e8f`](https://github.com/ardatan/whatwg-node/commit/9527e8fe2dc73e362b38060f4a6decbb87a4f597)
  Thanks [@ardatan](https://github.com/ardatan)! - Some implementations like `compression` npm
  package do not implement `response.write(data, callback)` signature, but whatwg-node/server waits
  for it to finish the response stream. Then it causes the response stream hangs when the
  compression package takes the stream over when the response data is larger than its threshold.

  It is actually a bug in `compression` package;
  [expressjs/compression#46](https://github.com/expressjs/compression/issues/46) But since it is a
  common mistake, we prefer to workaround this on our end.

  Now after calling `response.write`, it no longer uses callback but first it checks the result;

  if it is `true`, it means stream is drained and we can call `response.end` immediately. else if it
  is `false`, it means the stream is not drained yet, so we can wait for the `drain` event to call
  `response.end`.

- Updated dependencies
  [[`d86b4f3`](https://github.com/ardatan/whatwg-node/commit/d86b4f3df884709145023bf32bb1022c4a8bb9cb)]:
  - @whatwg-node/promise-helpers@1.3.2

## 0.7.18

### Patch Changes

- [#2305](https://github.com/ardatan/whatwg-node/pull/2305)
  [`380984a`](https://github.com/ardatan/whatwg-node/commit/380984ae072ece9f1d0106164a78143d81a1d02e)
  Thanks [@enisdenjo](https://github.com/enisdenjo)! - dependencies updates:

  - Added dependency
    [`@fastify/busboy@^3.1.1` ↗︎](https://www.npmjs.com/package/@fastify/busboy/v/3.1.1) (to
    `dependencies`)
  - Removed dependency [`busboy@^1.6.0` ↗︎](https://www.npmjs.com/package/busboy/v/1.6.0) (from
    `dependencies`)

- [#2305](https://github.com/ardatan/whatwg-node/pull/2305)
  [`380984a`](https://github.com/ardatan/whatwg-node/commit/380984ae072ece9f1d0106164a78143d81a1d02e)
  Thanks [@enisdenjo](https://github.com/enisdenjo)! - Abort parsing form data if the request is
  aborted

- [#2305](https://github.com/ardatan/whatwg-node/pull/2305)
  [`380984a`](https://github.com/ardatan/whatwg-node/commit/380984ae072ece9f1d0106164a78143d81a1d02e)
  Thanks [@enisdenjo](https://github.com/enisdenjo)! - Handle parsing form data when supplied
  Content-Length header value is smaller than the actual data

- Updated dependencies
  [[`6bf6aa0`](https://github.com/ardatan/whatwg-node/commit/6bf6aa0b6d4e0c7524aec55fb666147d0862c9b9)]:
  - @whatwg-node/promise-helpers@1.3.1

## 0.7.17

### Patch Changes

- [`770d4fe`](https://github.com/ardatan/whatwg-node/commit/770d4feeafc96ff6c55a02fbc8866b34a10b8d93)
  Thanks [@ardatan](https://github.com/ardatan)! - Pipe even if there is no signal

## 0.7.16

### Patch Changes

- [`1daa740`](https://github.com/ardatan/whatwg-node/commit/1daa740760b7413686d8a7722611fe1203351dda)
  Thanks [@ardatan](https://github.com/ardatan)! - Use promise pipeline

## 0.7.15

### Patch Changes

- [#2208](https://github.com/ardatan/whatwg-node/pull/2208)
  [`ff052a3`](https://github.com/ardatan/whatwg-node/commit/ff052a38b63995935309c54d0c150e21d4190126)
  Thanks [@ardatan](https://github.com/ardatan)! - When any `Request` method is called outside
  server adapter scope, it used to hang. This PR prevents it to hang and throw an error if the
  readable stream is destroyed earlier.

  ```ts
  let request: Request
  const adapter = createServerAdapter(req => {
    request = req
    return new Response('Hello World')
  })

  await request.text() // Was hanging but now throws an error
  ```

## 0.7.14

### Patch Changes

- [`2225af7`](https://github.com/ardatan/whatwg-node/commit/2225af7fc46f59c126005bb91065568c7b305a67)
  Thanks [@ardatan](https://github.com/ardatan)! - Use `URL` as the constructor name as some
  instrumentations like NewRelic needs it to be

## 0.7.13

### Patch Changes

- [#2182](https://github.com/ardatan/whatwg-node/pull/2182)
  [`a45e929`](https://github.com/ardatan/whatwg-node/commit/a45e9290cdc110392d9175d2780c96ad4fd31727)
  Thanks [@ardatan](https://github.com/ardatan)! - Use `Array.fromAsync` when possible to collect
  values

- Updated dependencies
  [[`a45e929`](https://github.com/ardatan/whatwg-node/commit/a45e9290cdc110392d9175d2780c96ad4fd31727)]:
  - @whatwg-node/promise-helpers@1.2.5

## 0.7.12

### Patch Changes

- [#2102](https://github.com/ardatan/whatwg-node/pull/2102)
  [`5cf6b2d`](https://github.com/ardatan/whatwg-node/commit/5cf6b2dbc589f4330c5efdee96356f48e438ae9e)
  Thanks [@ardatan](https://github.com/ardatan)! - dependencies updates:
  - Added dependency
    [`@whatwg-node/promise-helpers@^0.0.0` ↗︎](https://www.npmjs.com/package/@whatwg-node/promise-helpers/v/0.0.0)
    (to `dependencies`)
- Updated dependencies
  [[`5cf6b2d`](https://github.com/ardatan/whatwg-node/commit/5cf6b2dbc589f4330c5efdee96356f48e438ae9e),
  [`5cf6b2d`](https://github.com/ardatan/whatwg-node/commit/5cf6b2dbc589f4330c5efdee96356f48e438ae9e)]:
  - @whatwg-node/disposablestack@0.0.6
  - @whatwg-node/promise-helpers@1.0.0

## 0.7.11

### Patch Changes

- [#2093](https://github.com/ardatan/whatwg-node/pull/2093)
  [`31f021a`](https://github.com/ardatan/whatwg-node/commit/31f021ac5df1ddd7f16807d4ed6c5776d250ab29)
  Thanks [@ardatan](https://github.com/ardatan)! - Fixes the
  `TypeError: bodyInit.stream is not a function` error thrown when `@whatwg-node/server` is used
  with `node:http2` and attempts the incoming HTTP/2 request to parse with `Request.json`,
  `Request.text`, `Request.formData`, or `Request.blob` methods.

## 0.7.10

### Patch Changes

- [#2079](https://github.com/ardatan/whatwg-node/pull/2079)
  [`090b4b0`](https://github.com/ardatan/whatwg-node/commit/090b4b0d2aefbf36707fa236395bc6ea99227b9c)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix the bug when `set-cookies` given is ignored
  in `HeadersInit`;

  ```js
  import { Headers } from '@whatwg-node/fetch'

  const headers = new Headers([
    ['set-cookie', 'a=b'],
    ['set-cookie', 'c=d']
  ])
  expect(headers.getSetCookie()).toEqual(['a=b', 'c=d']) // Previously it was empty
  ```

## 0.7.9

### Patch Changes

- [#2049](https://github.com/ardatan/whatwg-node/pull/2049)
  [`7c95998`](https://github.com/ardatan/whatwg-node/commit/7c959987495a5d1d16e976e4119015c057bb9467)
  Thanks [@ardatan](https://github.com/ardatan)! - Redirect with correct status codes

- [#2051](https://github.com/ardatan/whatwg-node/pull/2051)
  [`252f68b`](https://github.com/ardatan/whatwg-node/commit/252f68b11d7b5f546172dbf8b734a35adcd4df3a)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix crash on null header values during inspect

- [#2009](https://github.com/ardatan/whatwg-node/pull/2009)
  [`5b5ae5f`](https://github.com/ardatan/whatwg-node/commit/5b5ae5f84511bb8966a683e49a3f7790549208a4)
  Thanks [@ardatan](https://github.com/ardatan)! - When `fetch('file:///...')` is used to read
  files;
  - 404 is returned if the file is missing
  - 403 is returned if the file is not accessible

## 0.7.8

### Patch Changes

- [`337e605`](https://github.com/ardatan/whatwg-node/commit/337e6051b71270bde7c1e1d38e19aa0e2fd9573f)
  Thanks [@ardatan](https://github.com/ardatan)! - - Use native AbortSignal and AbortController for
  Request.signal
  - Remove custom AbortSignal implementation (ServerAdapterAbortSignal)

## 0.7.7

### Patch Changes

- [#1961](https://github.com/ardatan/whatwg-node/pull/1961)
  [`2785c80`](https://github.com/ardatan/whatwg-node/commit/2785c80be2c887c581ef0fac8150befeab306eba)
  Thanks [@ardatan](https://github.com/ardatan)! - `ReadableStream`'s `Symbol.asyncIterator` now
  returns `AsyncIterableIterator` like before even if it is ok to return `AsyncIterator` right now.
  It is safer to return `AsyncIterableIterator` because it is a common mistake to use
  `AsyncIterator` as `AsyncIterable`.

## 0.7.6

### Patch Changes

- [#1929](https://github.com/ardatan/whatwg-node/pull/1929)
  [`b88b85c`](https://github.com/ardatan/whatwg-node/commit/b88b85c301923719f4722bdfe070728725bcc1b5)
  Thanks [@ardatan](https://github.com/ardatan)! - dependencies updates:

  - Removed dependency
    [`@kamilkisiela/fast-url-parser@^1.1.4` ↗︎](https://www.npmjs.com/package/@kamilkisiela/fast-url-parser/v/1.1.4)
    (from `dependencies`)
  - Removed dependency
    [`fast-querystring@^1.1.1` ↗︎](https://www.npmjs.com/package/fast-querystring/v/1.1.1) (from
    `dependencies`)

- [#1947](https://github.com/ardatan/whatwg-node/pull/1947)
  [`9b39c3e`](https://github.com/ardatan/whatwg-node/commit/9b39c3e5db616a60e6dd8472fbd651f4905f3673)
  Thanks [@ardatan](https://github.com/ardatan)! - Remove the event listener on the provided
  `AbortSignal` when `node-libcurl` is used, the connection finishes to prevent potential memory
  leaks;

  ```ts
  const res = await fetch(URL, { signal: new AbortController().signal })
  // AbortController is never aborted, and HTTP request is done as expected successfully
  ```

- [#1929](https://github.com/ardatan/whatwg-node/pull/1929)
  [`b88b85c`](https://github.com/ardatan/whatwg-node/commit/b88b85c301923719f4722bdfe070728725bcc1b5)
  Thanks [@ardatan](https://github.com/ardatan)! - - Remove URL ponyfill implementation based on
  `fast-url-parser` and `fast-querystring`, because Node now uses Ada URL parser which is fast
  enough.

  - Fix `ReadableStream[Symbol.asyncIterator]`

  `ReadableStream` uses `Readable` so it uses `Symbol.asyncIterator` method of `Readable` but the
  returned iterator's `.return` method doesn't handle cancellation correctly. So we need to call
  `readable.destroy(optionalError)` manually to cancel the stream.

  This allows `ReadableStream` to use implementations relying on `AsyncIterable.cancel` to handle
  cancellation like `Readable.from`

  Previously the following was not handling cancellation;

  ```ts
  const res = new ReadableStream({
    start(controller) {
      controller.enqueue('Hello')
      controller.enqueue('World')
    },
    cancel(reason) {
      console.log('cancelled', reason)
    }
  })

  const readable = Readable.from(res)

  readable.destroy(new Error('MY REASON'))

  // Should log 'cancelled MY REASON'
  ```

## 0.7.5

### Patch Changes

- [#1872](https://github.com/ardatan/whatwg-node/pull/1872)
  [`7fb47d8`](https://github.com/ardatan/whatwg-node/commit/7fb47d8e6a988658089315970d5662f5bf6bcb1f)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix the error thrown \`ENOTFOUND\` when a parsed
  URL with IPV6 hostname is given

  Instead of using the parsed URL passed to the `fetch` function, let `node:http` parse it again.
  This way, the IPV6 hostname is correctly resolved.

- [#1872](https://github.com/ardatan/whatwg-node/pull/1872)
  [`7fb47d8`](https://github.com/ardatan/whatwg-node/commit/7fb47d8e6a988658089315970d5662f5bf6bcb1f)
  Thanks [@ardatan](https://github.com/ardatan)! - `url.searchParams` parameter should reflect the
  changes in `toString()`

  ```ts
  const url = new URL('http://example.com/?a=b')
  url.searchParams.set('a', 'c')
  console.log(url.toString()) // http://example.com/?a=c
  ```

- [#1872](https://github.com/ardatan/whatwg-node/pull/1872)
  [`7fb47d8`](https://github.com/ardatan/whatwg-node/commit/7fb47d8e6a988658089315970d5662f5bf6bcb1f)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix IPV6 parsing in \`URL\`;

  `new URL('http://[::1]')` should parse the host as \`[::1]\` not \`::1\`.

## 0.7.4

### Patch Changes

- [`e88ab4a`](https://github.com/ardatan/whatwg-node/commit/e88ab4a826184c05d006620bbd3ef20942ea83d9)
  Thanks [@ardatan](https://github.com/ardatan)! - dependencies updates:
  - Added dependency
    [`@whatwg-node/disposablestack@^0.0.5` ↗︎](https://www.npmjs.com/package/@whatwg-node/disposablestack/v/0.0.5)
    (to `dependencies`)

## 0.7.3

### Patch Changes

- [#1814](https://github.com/ardatan/whatwg-node/pull/1814)
  [`54c244d`](https://github.com/ardatan/whatwg-node/commit/54c244d99757c1469ee226e54baffe7b5b0924c7)
  Thanks [@ardatan](https://github.com/ardatan)! - Small improvements for Bun support

## 0.7.2

### Patch Changes

- [#1790](https://github.com/ardatan/whatwg-node/pull/1790)
  [`c7d49b1`](https://github.com/ardatan/whatwg-node/commit/c7d49b1dad95412b99126c289a44b1fbf3473a65)
  Thanks [@ardatan](https://github.com/ardatan)! - Handle request abort correctly with AbortSignal

## 0.7.1

### Patch Changes

- [`c68f5ad`](https://github.com/ardatan/whatwg-node/commit/c68f5ad0782476b4b4facf490600b5f3341a4886)
  Thanks [@ardatan](https://github.com/ardatan)! - Pass errors to ReadableStream's cancel method
  properly when it is piped, and piped stream is cancelled

  Implement `ReadableStream.from`

## 0.7.0

### Minor Changes

- [#1782](https://github.com/ardatan/whatwg-node/pull/1782)
  [`6c006e1`](https://github.com/ardatan/whatwg-node/commit/6c006e12eaa6705cdf20b7b43cccc44a1f7ea185)
  Thanks [@ardatan](https://github.com/ardatan)! - \`TextDecoderStream\` and \`TextEncoderStream\`

## 0.6.0

### Minor Changes

- [#1644](https://github.com/ardatan/whatwg-node/pull/1644)
  [`637185f`](https://github.com/ardatan/whatwg-node/commit/637185f5c992ccabff13b185d4e14f09680228da)
  Thanks [@renovate](https://github.com/apps/renovate)! - Support `IteratorObject<T>`

## 0.5.27

### Patch Changes

- [`9281e02`](https://github.com/ardatan/whatwg-node/commit/9281e021282a43a3dda8c8a5c9647d340b28698e)
  Thanks [@ardatan](https://github.com/ardatan)! - Improve handling of \`AsyncIterable\` bodies

## 0.5.26

### Patch Changes

- [#1617](https://github.com/ardatan/whatwg-node/pull/1617)
  [`ed368bf`](https://github.com/ardatan/whatwg-node/commit/ed368bf6ab65e8141406a8b66f54d01785144490)
  Thanks [@ardatan](https://github.com/ardatan)! - # Fixes for usage of `node-libcurl`

  - Fix \`Error: SSL peer certificate or SSH remove key was not ok error\`, and use
    `tls.rootCertificates` as default certificates.

  [Learn more](https://github.com/JCMais/node-libcurl/blob/develop/COMMON_ISSUES.md)

  - Fix `API function called from within callback` by preventing the use of `curl_easy_perform` and
    `curl_multi_perform` inside callbacks.

## 0.5.25

### Patch Changes

- [#1592](https://github.com/ardatan/whatwg-node/pull/1592)
  [`71c79c6`](https://github.com/ardatan/whatwg-node/commit/71c79c639713ef738bd63f233ec20bdc1181b8e5)
  Thanks [@ardatan](https://github.com/ardatan)! - When cURL is used as the HTTP client
  implementation instead of node:http, `SSL_VERIFYPEER` should be set `false` when the
  `NODE_TLS_REJECT_UNAUTHORIZED` environment variable is set to `0`. `CAINFO` should be set to the
  value of the `NODE_EXTRA_CA_CERTS` environment variable.

  This allows the cURL client to use the same CA certificates and SSL configuration as `node:http`

- [#1592](https://github.com/ardatan/whatwg-node/pull/1592)
  [`71c79c6`](https://github.com/ardatan/whatwg-node/commit/71c79c639713ef738bd63f233ec20bdc1181b8e5)
  Thanks [@ardatan](https://github.com/ardatan)! - When `agent` is provided in `Request`, use
  `node:http` instead of `node-libcurl`

## 0.5.24

### Patch Changes

- [`39d9055`](https://github.com/ardatan/whatwg-node/commit/39d9055fe1ae0daed412e5689eb649cb4e313302)
  Thanks [@ardatan](https://github.com/ardatan)! - Prevent \`Curl handle is closed\` error

## 0.5.23

### Patch Changes

- [#1577](https://github.com/ardatan/whatwg-node/pull/1577)
  [`99c4344`](https://github.com/ardatan/whatwg-node/commit/99c4344ec82717be079e725538a532a827fbef82)
  Thanks [@ardatan](https://github.com/ardatan)! - - Improve native ReadableStream handling inside
  ponyfills
  - Use `waitUntil` instead of floating promises
  - Handle early termination in `WritableStream`
  - Handle `waitUntil` correctly within a dummy call of `ServerAdapter.fetch` method

## 0.5.22

### Patch Changes

- [#1566](https://github.com/ardatan/whatwg-node/pull/1566)
  [`de1e95a`](https://github.com/ardatan/whatwg-node/commit/de1e95a8eb107083e638aa8472089b96b33bbe4a)
  Thanks [@ardatan](https://github.com/ardatan)! - Avoid constructing DecompressionStream to check
  supported encodings

## 0.5.21

### Patch Changes

- [`1139796`](https://github.com/ardatan/whatwg-node/commit/11397962197b658995535bc402c1eaf6ba1b29bd)
  Thanks [@ardatan](https://github.com/ardatan)! - Small refactor to handle content length in Body
  impl

- [`4df7cdf`](https://github.com/ardatan/whatwg-node/commit/4df7cdf5f4a4a8a1cbdf9d51217c297d8f9895a7)
  Thanks [@ardatan](https://github.com/ardatan)! - \`Response.redirect\`'s default status code is
  \`302\`

## 0.5.20

### Patch Changes

- [`0d59a66`](https://github.com/ardatan/whatwg-node/commit/0d59a66289b99e3784ce50d35c5bf9c1c9a24db3)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix redirects from http to https

## 0.5.19

### Patch Changes

- [#1514](https://github.com/ardatan/whatwg-node/pull/1514)
  [`61a0480`](https://github.com/ardatan/whatwg-node/commit/61a0480f1f024b0455598c0c0bd213a74cd72394)
  Thanks [@ardatan](https://github.com/ardatan)! - dependencies updates:
  - Removed dependency
    [`@whatwg-node/events@^0.1.0` ↗︎](https://www.npmjs.com/package/@whatwg-node/events/v/0.1.0)
    (from `dependencies`)

## 0.5.18

### Patch Changes

- [`d261573`](https://github.com/ardatan/whatwg-node/commit/d26157339f3896509e45cb5c73aa61164d262d56)
  Thanks [@ardatan](https://github.com/ardatan)! - Support `new Blob()`

## 0.5.17

### Patch Changes

- [#1500](https://github.com/ardatan/whatwg-node/pull/1500)
  [`1f77112`](https://github.com/ardatan/whatwg-node/commit/1f77112c371137348f3f9ab8dc07bff724fcd131)
  Thanks [@ardatan](https://github.com/ardatan)! - Use suggested \`pipeline\` from \`node:streams\`
  to pipe streams to the final Response object

## 0.5.16

### Patch Changes

- [#1495](https://github.com/ardatan/whatwg-node/pull/1495)
  [`bebc159`](https://github.com/ardatan/whatwg-node/commit/bebc159e0a470a0ea89a8575f620ead3f1b6b594)
  Thanks [@ardatan](https://github.com/ardatan)! - Implement \`CompressionStream\`,
  \`WritableStream\` and \`TransformStream\`

## 0.5.15

### Patch Changes

- [`cf9733e`](https://github.com/ardatan/whatwg-node/commit/cf9733e9dce73c608970c6c12234cd7f2acde65d)
  Thanks [@ardatan](https://github.com/ardatan)! - Handle Buffers correctly in Blobs

## 0.5.14

### Patch Changes

- [#1481](https://github.com/ardatan/whatwg-node/pull/1481)
  [`481bdfd`](https://github.com/ardatan/whatwg-node/commit/481bdfd0734b6c2c70b17dccb701b068f8aa06d9)
  Thanks [@ardatan](https://github.com/ardatan)! - Send supported encoding formats in
  \`accept-encoding\` header by default

## 0.5.13

### Patch Changes

- [`145e46e`](https://github.com/ardatan/whatwg-node/commit/145e46e8d11ddfddb3fbb5335a1a959cc63c0eba)
  Thanks [@ardatan](https://github.com/ardatan)! - Implement `.bytes` method for `Blob` and `Body`,
  now `Uint8Array` is available with `bytes` format

## 0.5.12

### Patch Changes

- [`1c5b838`](https://github.com/ardatan/whatwg-node/commit/1c5b8383ae7020a6c01494001f1a1334c7818f3c)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix Request.clone and Response.clone

## 0.5.11

### Patch Changes

- [`e6234df`](https://github.com/ardatan/whatwg-node/commit/e6234df97be45f8c1e23c95c642c8b1d03ee433c)
  Thanks [@ardatan](https://github.com/ardatan)! - Handle request errors properly

## 0.5.10

### Patch Changes

- [#1219](https://github.com/ardatan/whatwg-node/pull/1219)
  [`fa097a4`](https://github.com/ardatan/whatwg-node/commit/fa097a466c483cafc2130d227a3728db054d97cd)
  Thanks [@ardatan](https://github.com/ardatan)! - Support blob: object URLs

- [#1219](https://github.com/ardatan/whatwg-node/pull/1219)
  [`fa097a4`](https://github.com/ardatan/whatwg-node/commit/fa097a466c483cafc2130d227a3728db054d97cd)
  Thanks [@ardatan](https://github.com/ardatan)! - Throw TypeError when multipart request is unable
  to parse as FormData

- [#1220](https://github.com/ardatan/whatwg-node/pull/1220)
  [`ac6b719`](https://github.com/ardatan/whatwg-node/commit/ac6b71921915e3b75c361956c01f65fbec4ffc69)
  Thanks [@ardatan](https://github.com/ardatan)! - Do not throw when Curl request cancellation

## 0.5.9

### Patch Changes

- [`dfb4290`](https://github.com/ardatan/whatwg-node/commit/dfb4290e7aac77dd2c3f6c5e654206b5dfa54a58)
  Thanks [@ardatan](https://github.com/ardatan)! - Send Content-Length:0 if the body is empty in
  POSTlike requests

## 0.5.8

### Patch Changes

- [#1190](https://github.com/ardatan/whatwg-node/pull/1190)
  [`c6f93ee`](https://github.com/ardatan/whatwg-node/commit/c6f93ee1692e9c1e56471e813855b4fb4ad2f0dd)
  Thanks [@ardatan](https://github.com/ardatan)! - Remove node: protocol which is not supported
  still in some Node versions and ESM mode

## 0.5.7

### Patch Changes

- [#1162](https://github.com/ardatan/whatwg-node/pull/1162)
  [`0c6e9ca`](https://github.com/ardatan/whatwg-node/commit/0c6e9ca61ee07b49009b6e4d7d9d5e1d80912450)
  Thanks [@ardatan](https://github.com/ardatan)! - Consume the body with PassThrough

## 0.5.6

### Patch Changes

- [`ad1e5a0`](https://github.com/ardatan/whatwg-node/commit/ad1e5a0a8408886b373edb19da619049b530cfcf)
  Thanks [@ardatan](https://github.com/ardatan)! - Use duplex half for stream based Requests

## 0.5.5

### Patch Changes

- [#1110](https://github.com/ardatan/whatwg-node/pull/1110)
  [`45ec735`](https://github.com/ardatan/whatwg-node/commit/45ec735bd3081f42221bdccb70692b420ce16efa)
  Thanks [@dac09](https://github.com/dac09)! - Support wrapping the native \`Request\`

- [#1111](https://github.com/ardatan/whatwg-node/pull/1111)
  [`a129376`](https://github.com/ardatan/whatwg-node/commit/a1293766bcf8d2465844aec1d80957e2af1b16f1)
  Thanks [@dac09](https://github.com/dac09)! - Support native `ReadableStream` as `BodyInit`

## 0.5.4

### Patch Changes

- [#1076](https://github.com/ardatan/whatwg-node/pull/1076)
  [`25796e3`](https://github.com/ardatan/whatwg-node/commit/25796e345480fe5323dddcdc033989b1792c2476)
  Thanks [@ctrlplusb](https://github.com/ctrlplusb)! - Fix abort logic for node-libcurl

## 0.5.3

### Patch Changes

- [`f844a4d`](https://github.com/ardatan/whatwg-node/commit/f844a4da5ddc8888b105b509fee7794c6217fd98)
  Thanks [@ardatan](https://github.com/ardatan)! - Support native File

## 0.5.2

### Patch Changes

- [#990](https://github.com/ardatan/whatwg-node/pull/990)
  [`c6806ff`](https://github.com/ardatan/whatwg-node/commit/c6806ff4228a03ce03caa0b3766efb34eb07c3e6)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - dependencies updates:

  - Added dependency
    [`@kamilkisiela/fast-url-parser@^1.1.4` ↗︎](https://www.npmjs.com/package/@kamilkisiela/fast-url-parser/v/1.1.4)
    (to `dependencies`)
  - Removed dependency
    [`fast-url-parser@^1.1.3` ↗︎](https://www.npmjs.com/package/fast-url-parser/v/1.1.3) (from
    `dependencies`)

- [#990](https://github.com/ardatan/whatwg-node/pull/990)
  [`c6806ff`](https://github.com/ardatan/whatwg-node/commit/c6806ff4228a03ce03caa0b3766efb34eb07c3e6)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Fix
  https://github.com/petkaantonov/urlparser/issues/20 by using
  https://github.com/kamilkisiela/fast-url-parser fork

## 0.5.1

### Patch Changes

- [`ea508c5`](https://github.com/ardatan/whatwg-node/commit/ea508c5db519651d9ad4c39141e319f9a3c89fdb)
  Thanks [@ardatan](https://github.com/ardatan)! - Iterate set-cookie headers correctly

## 0.5.0

### Minor Changes

- [#904](https://github.com/ardatan/whatwg-node/pull/904)
  [`f7e507f`](https://github.com/ardatan/whatwg-node/commit/f7e507f6565a1f9cd50fc8c01594ce21205a05dd)
  Thanks [@ardatan](https://github.com/ardatan)! - Drop Node 16 support

## 0.4.19

### Patch Changes

- [`c0a448f`](https://github.com/ardatan/whatwg-node/commit/c0a448f59cb91036afeae12cf074a046532817d3)
  Thanks [@ardatan](https://github.com/ardatan)! - Small improvements for less promise usage

## 0.4.18

### Patch Changes

- [`67ed782`](https://github.com/ardatan/whatwg-node/commit/67ed782c878288e4aeeba9619e916cf6eb456709)
  Thanks [@ardatan](https://github.com/ardatan)! - Iterate over blob parts correctly

## 0.4.17

### Patch Changes

- [`a8467ab`](https://github.com/ardatan/whatwg-node/commit/a8467ab9e3e4701eb0d3101ff904597cd9adc438)
  Thanks [@ardatan](https://github.com/ardatan)! - Fake promise's then method may not take a
  callback function

## 0.4.16

### Patch Changes

- [`96efb10`](https://github.com/ardatan/whatwg-node/commit/96efb10a4508fa1b86482f5238d63ec6015e0d74)
  Thanks [@ardatan](https://github.com/ardatan)! - Ignore content-length while reading the request
  body

## 0.4.15

### Patch Changes

- [#806](https://github.com/ardatan/whatwg-node/pull/806)
  [`9b6911a`](https://github.com/ardatan/whatwg-node/commit/9b6911a8fca0fc046278a8b490e14eb4412da98f)
  Thanks [@ardatan](https://github.com/ardatan)! - Return `Buffer` instead of `ArrayBuffer` in
  `.arrayBuffer` due to a bug in Node.js that returns a bigger ArrayBuffer causing memory overflow

## 0.4.14

### Patch Changes

- [#777](https://github.com/ardatan/whatwg-node/pull/777)
  [`e3ae0a3`](https://github.com/ardatan/whatwg-node/commit/e3ae0a37c6aae11b249ea3134feb4a55a0cd288c)
  Thanks [@ardatan](https://github.com/ardatan)! - Do not create a new Buffer to uWS and node-http,
  and use the existing Buffer instead for better performance in Node.js.

## 0.4.13

### Patch Changes

- [`4b67036`](https://github.com/ardatan/whatwg-node/commit/4b67036b1e84e43e103e7fe9b69d240a72be6e6d)
  Thanks [@ardatan](https://github.com/ardatan)! - Handle AbortSignal

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
