# @whatwg-node/server

## 0.10.2

### Patch Changes

- [`ace1774`](https://github.com/ardatan/whatwg-node/commit/ace1774b545dc7ebdaa6932368796decd76b5e2f)
  Thanks [@ardatan](https://github.com/ardatan)! - Expose `waitUntil` method in the adapter

## 0.10.1

### Patch Changes

- [#2145](https://github.com/ardatan/whatwg-node/pull/2145)
  [`dac036c`](https://github.com/ardatan/whatwg-node/commit/dac036c95987813ea4a1f6d46904274b867b7e8e)
  Thanks [@ardatan](https://github.com/ardatan)! - dependencies updates:
  - Added dependency
    [`@envelop/instrumentation@^1.0.0` ↗︎](https://www.npmjs.com/package/@envelop/instrumentation/v/1.0.0)
    (to `dependencies`)
  - Removed dependency
    [`@envelop/instruments@1.0.0` ↗︎](https://www.npmjs.com/package/@envelop/instruments/v/1.0.0)
    (from `dependencies`)

## 0.10.0

### Minor Changes

- [#2068](https://github.com/ardatan/whatwg-node/pull/2068)
  [`516bf60`](https://github.com/ardatan/whatwg-node/commit/516bf60b55babd57e1721d404a01c526ec218acf)
  Thanks [@EmrysMyrddin](https://github.com/EmrysMyrddin)! - Add new Instrumentation API

  Introduction of a new API allowing to instrument the graphql pipeline.

  This new API differs from already existing Hooks by not having access to input/output of phases.
  The goal of `Instrumentation` is to run allow running code before, after or around the **whole
  process of a phase**, including plugins hooks executions.

  The main use case of this new API is observability (monitoring, tracing, etc...).

  ### Basic usage

  ```ts
  import Sentry from '@sentry/node'
  import { createServerAdapter } from '@whatwg-node/server'

  const server = createServerAdapter(
    (req, res) => {
      //...
    },
    {
      plugins: [
        {
          instrumentation: {
            request: ({ request }, wrapped) =>
              Sentry.startSpan({ name: 'Graphql Operation' }, async () => {
                try {
                  await wrapped()
                } catch (err) {
                  Sentry.captureException(err)
                }
              })
          }
        }
      ]
    }
  )
  ```

  ### Multiple instrumentation plugins

  It is possible to have multiple instrumentation plugins (Prometheus and Sentry for example), they
  will be automatically composed by envelop in the same order than the plugin array (first is
  outermost, last is inner most).

  ```ts
  import { createServerAdapter } from '@whatwg-node/server'

  const server = createServerAdapter(
    (req, res) => {
      //...
    },
    { plugins: [useSentry(), useOpentelemetry()] }
  )
  ```

  ```mermaid
  sequenceDiagram
    Sentry->>Opentelemetry: ;
    Opentelemetry->>Server Adapter: ;
    Server Adapter->>Opentelemetry: ;
    Opentelemetry->>Sentry: ;
  ```

  ### Custom instrumentation ordering

  If the default composition ordering doesn't suite your need, you can manually compose
  instrumentation. This allows to have a different execution order of hooks and instrumentation.

  ```ts
  import { composeInstrumentation, createServerAdapter } from '@whatwg-node/server'

  const { instrumentation: sentryInstrumentation, ...sentryPlugin } = useSentry()
  const { instrumentation: otelInstrumentation, ...otelPlugin } = useOpentelemetry()
  const instrumentation = composeInstrumentation([otelInstrumentation, sentryInstrumentation])

  const server = createServerAdapter(
    (req, res) => {
      //...
    },
    { plugins: [{ instrumentation }, sentryPlugin, otelPlugin] }
  )
  ```

  ```mermaid
  sequenceDiagram
    Opentelemetry->>Sentry: ;
    Sentry->>Server Adapter: ;
    Server Adapter->>Sentry: ;
    Sentry->>Opentelemetry: ;
  ```

### Patch Changes

- [#2068](https://github.com/ardatan/whatwg-node/pull/2068)
  [`516bf60`](https://github.com/ardatan/whatwg-node/commit/516bf60b55babd57e1721d404a01c526ec218acf)
  Thanks [@EmrysMyrddin](https://github.com/EmrysMyrddin)! - dependencies updates:
  - Updated dependency
    [`@whatwg-node/promise-helpers@^1.2.2` ↗︎](https://www.npmjs.com/package/@whatwg-node/promise-helpers/v/1.2.2)
    (from `^1.0.0`, in `dependencies`)
  - Added dependency
    [`@envelop/instrumentation@1.0.0` ↗︎](https://www.npmjs.com/package/@envelop/instrumentation/v/1.0.0)
    (to `dependencies`)
- Updated dependencies
  [[`516bf60`](https://github.com/ardatan/whatwg-node/commit/516bf60b55babd57e1721d404a01c526ec218acf)]:
  - @whatwg-node/promise-helpers@1.2.3

## 0.9.71

### Patch Changes

- [#2117](https://github.com/ardatan/whatwg-node/pull/2117)
  [`6631a27`](https://github.com/ardatan/whatwg-node/commit/6631a27f1a3dafe4af99b3e3e4f3feb973f0a77f)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix the error
  `The Request.url getter can only be used on instances of Request` when the adapter is used with
  Express on Bun
- Updated dependencies
  [[`2ca563a`](https://github.com/ardatan/whatwg-node/commit/2ca563a205d12fa6f0bfe2fec39c838b757f7319)]:
  - @whatwg-node/promise-helpers@1.2.2

## 0.9.70

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

## 0.9.69

### Patch Changes

- [#2093](https://github.com/ardatan/whatwg-node/pull/2093)
  [`31f021a`](https://github.com/ardatan/whatwg-node/commit/31f021ac5df1ddd7f16807d4ed6c5776d250ab29)
  Thanks [@ardatan](https://github.com/ardatan)! - Fixes the
  `TypeError: bodyInit.stream is not a function` error thrown when `@whatwg-node/server` is used
  with `node:http2` and attempts the incoming HTTP/2 request to parse with `Request.json`,
  `Request.text`, `Request.formData`, or `Request.blob` methods.

- Updated dependencies
  [[`31f021a`](https://github.com/ardatan/whatwg-node/commit/31f021ac5df1ddd7f16807d4ed6c5776d250ab29)]:
  - @whatwg-node/fetch@0.10.5

## 0.9.68

### Patch Changes

- [#2082](https://github.com/ardatan/whatwg-node/pull/2082)
  [`b217e30`](https://github.com/ardatan/whatwg-node/commit/b217e305b5a5d63e164cf83ef45e7d1e95fefa0e)
  Thanks [@ardatan](https://github.com/ardatan)! - dependencies updates:
  - Updated dependency
    [`@whatwg-node/fetch@^0.10.3` ↗︎](https://www.npmjs.com/package/@whatwg-node/fetch/v/0.10.3)
    (from `^0.10.0`, in `dependencies`)
- Updated dependencies
  [[`b217e30`](https://github.com/ardatan/whatwg-node/commit/b217e305b5a5d63e164cf83ef45e7d1e95fefa0e),
  [`090b4b0`](https://github.com/ardatan/whatwg-node/commit/090b4b0d2aefbf36707fa236395bc6ea99227b9c)]:
  - @whatwg-node/fetch@0.10.4

## 0.9.67

### Patch Changes

- [#2057](https://github.com/ardatan/whatwg-node/pull/2057)
  [`7d28669`](https://github.com/ardatan/whatwg-node/commit/7d2866920a7439d93073dec15f5c2321e9e6be71)
  Thanks [@ardatan](https://github.com/ardatan)! - When two plugins use the `onResponse` hook and
  the first one modifies the response, the second one should get the modified one;

  ```ts
  ;[
    {
      onResponse({ setResponse, fetchAPI }) {
        setResponse(
          fetchAPI.Response.json(
            {
              foo: 'bar'
            },
            { status: 418 }
          )
        )
      }
    },
    {
      onResponse({ response }) {
        console.log(response.status) // 418
      }
    }
  ]
  ```

## 0.9.66

### Patch Changes

- [`337e605`](https://github.com/ardatan/whatwg-node/commit/337e6051b71270bde7c1e1d38e19aa0e2fd9573f)
  Thanks [@ardatan](https://github.com/ardatan)! - - Use native AbortSignal and AbortController for
  Request.signal
  - Remove custom AbortSignal implementation (ServerAdapterAbortSignal)

## 0.9.65

### Patch Changes

- [#1926](https://github.com/ardatan/whatwg-node/pull/1926)
  [`bae5de1`](https://github.com/ardatan/whatwg-node/commit/bae5de158dd2fa3472d69ca7486ea68940d43c74)
  Thanks [@ardatan](https://github.com/ardatan)! - While calling `handleNodeRequest` or
  `handleNodeRequestAndResponse`, `waitUntil` is not added automatically as in `requestListener` for
  Node.js integration. This change adds `waitUntil` into the `serverContext` if not present.

  Fixes the issue with Fastify integration that uses the mentioned methods

## 0.9.64

### Patch Changes

- [#1899](https://github.com/ardatan/whatwg-node/pull/1899)
  [`a84e84a`](https://github.com/ardatan/whatwg-node/commit/a84e84aa5c14f23c30637ccd290a099a39c445a1)
  Thanks [@ardatan](https://github.com/ardatan)! - - New `onDispose` hook which is alias of
  `Symbol.asyncDispose` for Explicit Resource Management

  - Registration of the server adapter's disposal to the global process termination listener is now
    opt-in and configurable.

  ```ts
  const plugin: ServerAdapterPlugin = {
    onDispose() {
      console.log('Server adapter is disposed')
    }
  }

  const serverAdapter = createServerAdapter(() => new Response('Hello world!'), {
    plugins: [plugin],
    // Register the server adapter's disposal to the global process termination listener
    // Then the server adapter will be disposed when the process exit signals only in Node.js!
    disposeOnProcessTerminate: true
  })

  await serverAdapter.dispose()
  // Prints 'Server adapter is disposed'
  ```

## 0.9.63

### Patch Changes

- [`c75e6e3`](https://github.com/ardatan/whatwg-node/commit/c75e6e39207664c7a33fcb1ba0f211774e0c7c97)
  Thanks [@ardatan](https://github.com/ardatan)! - Export \`DisposableSymbols\` for disposable
  plugins

## 0.9.62

### Patch Changes

- [#1880](https://github.com/ardatan/whatwg-node/pull/1880)
  [`95e5ce4`](https://github.com/ardatan/whatwg-node/commit/95e5ce4a32e51b8727b31ea711903e7924c8e47e)
  Thanks [@EmrysMyrddin](https://github.com/EmrysMyrddin)! - Docs for hooks

## 0.9.61

### Patch Changes

- [#1872](https://github.com/ardatan/whatwg-node/pull/1872)
  [`7fb47d8`](https://github.com/ardatan/whatwg-node/commit/7fb47d8e6a988658089315970d5662f5bf6bcb1f)
  Thanks [@ardatan](https://github.com/ardatan)! - Wait for remaining promises during `asyncDispose`
  correctly

  The `asyncDispose` function should wait for all remaining promises to resolve before returning.
  This ensures that the server is fully disposed of before the function returns.

  ```ts
  import { createServerAdapter } from '@whatwg-node/server'

  const deferred = Promise.withResolvers()

  const adapter = createServerAdapter((req, ctx) => {
    ctx.waitUntil(deferred.promise)
    return new Response('Hello, world!')
  })

  const res = await adapter.fetch('http://example.com')
  console.assert(res.status === 200)
  console.assert((await res.text()) === 'Hello, world!')

  let disposed = false
  adapter[Symbol.asyncDispose]().then(() => {
    disposed = true
  })

  console.assert(!disposed)

  deferred.resolve()

  console.assert(disposed)
  ```

## 0.9.60

### Patch Changes

- [#1838](https://github.com/ardatan/whatwg-node/pull/1838)
  [`8947888`](https://github.com/ardatan/whatwg-node/commit/894788854a212932fffde7a52e88c21cd696c6db)
  Thanks [@ardatan](https://github.com/ardatan)! - Respect SIGTERM as termination event

## 0.9.59

### Patch Changes

- [`b4ab548`](https://github.com/ardatan/whatwg-node/commit/b4ab548cf11a0ec641e1800690684176eecad74b)
  Thanks [@ardatan](https://github.com/ardatan)! - Remove SIGTERM from termination events to prevent
  hangs, and always add disposable stack to the termination events

## 0.9.58

### Patch Changes

- [`5a9098c`](https://github.com/ardatan/whatwg-node/commit/5a9098cdc2984c4ad80e136fc93250a97145852e)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix on plugin types

## 0.9.57

### Patch Changes

- [`e88ab4a`](https://github.com/ardatan/whatwg-node/commit/e88ab4a826184c05d006620bbd3ef20942ea83d9)
  Thanks [@ardatan](https://github.com/ardatan)! - dependencies updates:

  - Added dependency
    [`@whatwg-node/disposablestack@^0.0.5` ↗︎](https://www.npmjs.com/package/@whatwg-node/disposablestack/v/0.0.5)
    (to `dependencies`)

- [`e88ab4a`](https://github.com/ardatan/whatwg-node/commit/e88ab4a826184c05d006620bbd3ef20942ea83d9)
  Thanks [@ardatan](https://github.com/ardatan)! - New Explicit Resource Management feature for the
  server adapters;
  [Learn more](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html)
  - `Symbol.dispose` and `Symbol.asyncDispose` hooks When the server adapter plugin has these hooks,
    it is added to the disposable stack of the server adapter. When the server adapter is disposed,
    those hooks are triggered
  - `disposableStack` in the server adapter The shared disposable stack that will be triggered when
    `Symbol.asyncDispose` is called.
  - Automatic disposal on Node and Node-compatible environments Even if the server adapter is not
    disposed explicitly, the disposal logic will be triggered on the process termination (SIGINT,
    SIGTERM etc)
  - ctx.waitUntil relation If it is an environment does not natively provide `waitUntil`, the
    unresolved passed promises will be resolved by the disposable stack.

## 0.9.56

### Patch Changes

- [#1814](https://github.com/ardatan/whatwg-node/pull/1814)
  [`54c244d`](https://github.com/ardatan/whatwg-node/commit/54c244d99757c1469ee226e54baffe7b5b0924c7)
  Thanks [@ardatan](https://github.com/ardatan)! - Small improvements for Bun support

## 0.9.55

### Patch Changes

- [#1799](https://github.com/ardatan/whatwg-node/pull/1799)
  [`7d1f0ff`](https://github.com/ardatan/whatwg-node/commit/7d1f0ff4675911ecb249d609d200fd69f77e8d94)
  Thanks [@ardatan](https://github.com/ardatan)! - Avoid polluting the original object in case of
  \`Object.create\`

## 0.9.54

### Patch Changes

- [#1790](https://github.com/ardatan/whatwg-node/pull/1790)
  [`c7d49b1`](https://github.com/ardatan/whatwg-node/commit/c7d49b1dad95412b99126c289a44b1fbf3473a65)
  Thanks [@ardatan](https://github.com/ardatan)! - Handle request abort correctly with AbortSignal

## 0.9.53

### Patch Changes

- Updated dependencies
  [[`6c006e1`](https://github.com/ardatan/whatwg-node/commit/6c006e12eaa6705cdf20b7b43cccc44a1f7ea185)]:
  - @whatwg-node/fetch@0.10.0

## 0.9.52

### Patch Changes

- [`323a519`](https://github.com/ardatan/whatwg-node/commit/323a5191a93c8a0a614077f89a2197b9c087a969)
  Thanks [@ardatan](https://github.com/ardatan)! - Allow other libs to redefine `Request`'s
  properties

## 0.9.51

### Patch Changes

- [#1644](https://github.com/ardatan/whatwg-node/pull/1644)
  [`637185f`](https://github.com/ardatan/whatwg-node/commit/637185f5c992ccabff13b185d4e14f09680228da)
  Thanks [@renovate](https://github.com/apps/renovate)! - Respect given fetchAPI

- Updated dependencies []:
  - @whatwg-node/fetch@0.9.23

## 0.9.50

### Patch Changes

- [`9281e02`](https://github.com/ardatan/whatwg-node/commit/9281e021282a43a3dda8c8a5c9647d340b28698e)
  Thanks [@ardatan](https://github.com/ardatan)! - Improvements with uWS Body handling

- Updated dependencies
  [[`77dd1c3`](https://github.com/ardatan/whatwg-node/commit/77dd1c3acde29aeb828b6eb37b6fbdbb47a16c57)]:
  - @whatwg-node/fetch@0.9.22

## 0.9.49

### Patch Changes

- [`8a43669`](https://github.com/ardatan/whatwg-node/commit/8a4366984a1854e93251e43711a1c50541818e9f)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix waitUntil issue

## 0.9.48

### Patch Changes

- [#1577](https://github.com/ardatan/whatwg-node/pull/1577)
  [`99c4344`](https://github.com/ardatan/whatwg-node/commit/99c4344ec82717be079e725538a532a827fbef82)
  Thanks [@ardatan](https://github.com/ardatan)! - - Improve native ReadableStream handling inside
  ponyfills
  - Use `waitUntil` instead of floating promises
  - Handle early termination in `WritableStream`
  - Handle `waitUntil` correctly within a dummy call of `ServerAdapter.fetch` method
- Updated dependencies
  [[`99c4344`](https://github.com/ardatan/whatwg-node/commit/99c4344ec82717be079e725538a532a827fbef82)]:
  - @whatwg-node/fetch@0.9.21

## 0.9.47

### Patch Changes

- [#1566](https://github.com/ardatan/whatwg-node/pull/1566)
  [`de1e95a`](https://github.com/ardatan/whatwg-node/commit/de1e95a8eb107083e638aa8472089b96b33bbe4a)
  Thanks [@ardatan](https://github.com/ardatan)! - Avoid constructing DecompressionStream to check
  supported encodings

- Updated dependencies
  [[`de1e95a`](https://github.com/ardatan/whatwg-node/commit/de1e95a8eb107083e638aa8472089b96b33bbe4a)]:
  - @whatwg-node/fetch@0.9.20

## 0.9.46

### Patch Changes

- [`9805a25`](https://github.com/ardatan/whatwg-node/commit/9805a2525c3d1c3b093000ef1111f770b8e8496a)
  Thanks [@ardatan](https://github.com/ardatan)! - While using `useContentEncoding`, if compression
  is applied in both ends, respect `Accept-Encoding` from the client correctly

## 0.9.45

### Patch Changes

- [#1088](https://github.com/ardatan/whatwg-node/pull/1088)
  [`8b2d14a`](https://github.com/ardatan/whatwg-node/commit/8b2d14a1dd81aeaf651fbbe28b16efe15bcde15a)
  Thanks [@f5io](https://github.com/f5io)! - Wait for the server response to drain the existing data
  in the stream then send the other one

## 0.9.44

### Patch Changes

- [#1495](https://github.com/ardatan/whatwg-node/pull/1495)
  [`bebc159`](https://github.com/ardatan/whatwg-node/commit/bebc159e0a470a0ea89a8575f620ead3f1b6b594)
  Thanks [@ardatan](https://github.com/ardatan)! - Implement \`CompressionStream\`,
  \`WritableStream\` and \`TransformStream\`

- Updated dependencies
  [[`bebc159`](https://github.com/ardatan/whatwg-node/commit/bebc159e0a470a0ea89a8575f620ead3f1b6b594)]:
  - @whatwg-node/fetch@0.9.19

## 0.9.43

### Patch Changes

- [`91df5d2`](https://github.com/ardatan/whatwg-node/commit/91df5d250d052ec504a1609a66cc5ae1ac72c686)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix descriptor issue when .fetch is used with
  dummy context

## 0.9.42

### Patch Changes

- [`5fa49ca`](https://github.com/ardatan/whatwg-node/commit/5fa49caf6bf6f65791aae3da2edbe8c2136cd53e)
  Thanks [@ardatan](https://github.com/ardatan)! - Small fix that happens when .fetch receives a
  dummy request

## 0.9.41

### Patch Changes

- [`d238c52`](https://github.com/ardatan/whatwg-node/commit/d238c5213a9e80afc393bbfc7d48bc29752f1661)
  Thanks [@ardatan](https://github.com/ardatan)! - Do not apply decompression for fetch method

## 0.9.40

### Patch Changes

- [#1465](https://github.com/ardatan/whatwg-node/pull/1465)
  [`9f6546f`](https://github.com/ardatan/whatwg-node/commit/9f6546f7c27ab00ba7d44e82c4557135d0217c8a)
  Thanks [@EmrysMyrddin](https://github.com/EmrysMyrddin)! - Fix context type to expose the
  `waitUntil` method.

## 0.9.39

### Patch Changes

- [`a3732a6`](https://github.com/ardatan/whatwg-node/commit/a3732a6c85dbce173b0946f70e3628c23738c799)
  Thanks [@ardatan](https://github.com/ardatan)! - Update content-length when compressed

## 0.9.38

### Patch Changes

- [`f7bcbea`](https://github.com/ardatan/whatwg-node/commit/f7bcbea0c0a940870efb47faeb4b64d07d990ce4)
  Thanks [@ardatan](https://github.com/ardatan)! - Support \`Content-Encoding: none\`

## 0.9.37

### Patch Changes

- [#1481](https://github.com/ardatan/whatwg-node/pull/1481)
  [`481bdfd`](https://github.com/ardatan/whatwg-node/commit/481bdfd0734b6c2c70b17dccb701b068f8aa06d9)
  Thanks [@ardatan](https://github.com/ardatan)! - New plugin to handle E2E request compression

  When the client provides `Accept-Encoding` header, if the server supports the encoding, it will
  compress the response body. This will reduce the size of the response body and improve the
  performance of the application.

  On the other hand, if the client sends `Content-Encoding` header, the server will decompress the
  request body before processing it. This will allow the server to handle the request body in its
  original form. If the server does not support the encoding, it will respond with
  `415 Unsupported Media Type` status code.

  `serverAdapter`'s `fetch` function handles the compression and decompression of the request and
  response bodies.

  ```ts
  import { createServerAdapter, Response, useContentEncoding } from '@whatwg-node/server'

  const serverAdapter = createServerAdapter(() => Response.json({ hello: 'world' }), {
    plugins: [useContentEncoding()]
  })
  ```

## 0.9.36

### Patch Changes

- [#1407](https://github.com/ardatan/whatwg-node/pull/1407)
  [`ebbc85b`](https://github.com/ardatan/whatwg-node/commit/ebbc85b5dbf1fad554718276f2892012c59cbabe)
  Thanks [@Akryum](https://github.com/Akryum)! - Vary: Access-Control-Request-Headers would
  overwrite Vary: Origin

## 0.9.35

### Patch Changes

- [`cf07839`](https://github.com/ardatan/whatwg-node/commit/cf078397ceec3dc2e331b8507c076c05d50dac45)
  Thanks [@ardatan](https://github.com/ardatan)! - Fixes TypeScript v5.5 compatibility issues

## 0.9.34

### Patch Changes

- [`e6234df`](https://github.com/ardatan/whatwg-node/commit/e6234df97be45f8c1e23c95c642c8b1d03ee433c)
  Thanks [@ardatan](https://github.com/ardatan)! - Do not call res.onAborted multiple times because
  it causes it to overwrite the previous listener, and use AbortSignal's abort event instead

## 0.9.33

### Patch Changes

- [#1246](https://github.com/ardatan/whatwg-node/pull/1246)
  [`4717be5`](https://github.com/ardatan/whatwg-node/commit/4717be5a0311334c81176c4a3bc6c01e286f3a39)
  Thanks [@ardatan](https://github.com/ardatan)! - Ensure unique context objects are sent per each
  request.

  For example in CloudFlare Workers, `fetch` receives `env` and `ctx`, and `env` is shared across
  requests. That causes the server receives the same context object for each request. Now the server
  creates a new context object for each request, even if the first argument is the same. Before, it
  always takes the first argument as the context object, then merges the following arguments into
  it.

## 0.9.32

### Patch Changes

- [#1224](https://github.com/ardatan/whatwg-node/pull/1224)
  [`d6bec0a`](https://github.com/ardatan/whatwg-node/commit/d6bec0aae49f8f6d2b27b62c53ba7cde2ce40485)
  Thanks [@ardatan](https://github.com/ardatan)! - Introduce `handleRequestFromResponse` method for
  a better Fastify integration

## 0.9.31

### Patch Changes

- [#1220](https://github.com/ardatan/whatwg-node/pull/1220)
  [`ac6b719`](https://github.com/ardatan/whatwg-node/commit/ac6b71921915e3b75c361956c01f65fbec4ffc69)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix UWS's behavior in case of request
  cancellation

- [#1220](https://github.com/ardatan/whatwg-node/pull/1220)
  [`ac6b719`](https://github.com/ardatan/whatwg-node/commit/ac6b71921915e3b75c361956c01f65fbec4ffc69)
  Thanks [@ardatan](https://github.com/ardatan)! - Use ServerResponse's close event to catch request
  cancellation

## 0.9.30

### Patch Changes

- [#1218](https://github.com/ardatan/whatwg-node/pull/1218)
  [`1443f93`](https://github.com/ardatan/whatwg-node/commit/1443f9320561c1334d9de890c8847fb874cb67fa)
  Thanks [@ardatan](https://github.com/ardatan)! - Set \`reason\` in
  \`ServerAdapterRequestAbortSignal\` to get a proper error when the request got aborted by the
  client

## 0.9.29

### Patch Changes

- [#1190](https://github.com/ardatan/whatwg-node/pull/1190)
  [`c6f93ee`](https://github.com/ardatan/whatwg-node/commit/c6f93ee1692e9c1e56471e813855b4fb4ad2f0dd)
  Thanks [@ardatan](https://github.com/ardatan)! - Remove node: protocol which is not supported
  still in some Node versions and ESM mode

## 0.9.28

### Patch Changes

- [`3f31f2d`](https://github.com/ardatan/whatwg-node/commit/3f31f2d607e4638eb92af139442bba610b33f70e)
  Thanks [@ardatan](https://github.com/ardatan)! - Handle errors from async request handlers
  correctly in case of AbortSignal

## 0.9.27

### Patch Changes

- [`a686f8c`](https://github.com/ardatan/whatwg-node/commit/a686f8c49828303e4dd3582ff6212b233fac1c9f)
  Thanks [@ardatan](https://github.com/ardatan)! - Respect user provided `AbortSignal` correctly

## 0.9.26

### Patch Changes

- [#1143](https://github.com/ardatan/whatwg-node/pull/1143)
  [`9958bb1`](https://github.com/ardatan/whatwg-node/commit/9958bb1367e1918217abb4244df1685aa1e025fe)
  Thanks [@aarne](https://github.com/aarne)! - Fix async handling of uWS

- Updated dependencies
  [[`0c6e9ca`](https://github.com/ardatan/whatwg-node/commit/0c6e9ca61ee07b49009b6e4d7d9d5e1d80912450)]:
  - @whatwg-node/fetch@0.9.17

## 0.9.25

### Patch Changes

- [`ad1e5a0`](https://github.com/ardatan/whatwg-node/commit/ad1e5a0a8408886b373edb19da619049b530cfcf)
  Thanks [@ardatan](https://github.com/ardatan)! - Use duplex half for stream based Requests

## 0.9.24

### Patch Changes

- [#1101](https://github.com/ardatan/whatwg-node/pull/1101)
  [`bf0c9ab`](https://github.com/ardatan/whatwg-node/commit/bf0c9ab7d2894f9c604c2b6d9f6e4d72eec074fb)
  Thanks [@ardatan](https://github.com/ardatan)! - Access the property in the given server context
  object correctly

## 0.9.23

### Patch Changes

- [`f775c41`](https://github.com/ardatan/whatwg-node/commit/f775c41b255c75a84102ebb1928e986813c31372)
  Thanks [@ardatan](https://github.com/ardatan)! - If protocol is not available, use
  socket.encrypted correctly

## 0.9.22

### Patch Changes

- [`340c719`](https://github.com/ardatan/whatwg-node/commit/340c719b1e54bcb8446f0b648d9a9c906557e7f4)
  Thanks [@ardatan](https://github.com/ardatan)! - Handle aborted requests correctly

## 0.9.21

### Patch Changes

- [#1015](https://github.com/ardatan/whatwg-node/pull/1015)
  [`84e6e37`](https://github.com/ardatan/whatwg-node/commit/84e6e3771360b163ee8c41177b08640ec2a793a7)
  Thanks [@ardatan](https://github.com/ardatan)! - Send AbortSignal at correct time

## 0.9.20

### Patch Changes

- [`eb326a6`](https://github.com/ardatan/whatwg-node/commit/eb326a6e00fb75305b3cf2bd9187b8e55dcf85f2)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix for undefined server context parts

## 0.9.19

### Patch Changes

- [#997](https://github.com/ardatan/whatwg-node/pull/997)
  [`0c28ae9`](https://github.com/ardatan/whatwg-node/commit/0c28ae90f531fb98ea9d9b585b530a5f542f1d60)
  Thanks [@ardatan](https://github.com/ardatan)! - Avoid mutating the static context

  For example if the adapter receives the server object as the server context, it is isolated and
  the handler cannot mutate it, otherwise it will leak. Bun does that so this patch is needed to
  avoid leaking the server object.

## 0.9.18

### Patch Changes

- [`3fefa17`](https://github.com/ardatan/whatwg-node/commit/3fefa178d6215a92570a4765b84321873ec44db6)
  Thanks [@ardatan](https://github.com/ardatan)! - Support Bun's Node compat mode

## 0.9.17

### Patch Changes

- [`ea508c5`](https://github.com/ardatan/whatwg-node/commit/ea508c5db519651d9ad4c39141e319f9a3c89fdb)
  Thanks [@ardatan](https://github.com/ardatan)! - Iterate set-cookie headers correctly

## 0.9.16

### Patch Changes

- [`e4061de`](https://github.com/ardatan/whatwg-node/commit/e4061de6296d70da853eca9729092a43aeab7884)
  Thanks [@ardatan](https://github.com/ardatan)! - If Response.error is not implemented, use
  Response ctor directly

## 0.9.15

### Patch Changes

- [`a808346`](https://github.com/ardatan/whatwg-node/commit/a8083469003458bd33a5afe77ea766c5ffaab6b6)
  Thanks [@ardatan](https://github.com/ardatan)! - Improve error handling plugin

## 0.9.14

### Patch Changes

- [#806](https://github.com/ardatan/whatwg-node/pull/806)
  [`9b6911a`](https://github.com/ardatan/whatwg-node/commit/9b6911a8fca0fc046278a8b490e14eb4412da98f)
  Thanks [@ardatan](https://github.com/ardatan)! - Return `Buffer` instead of `ArrayBuffer` in
  `.arrayBuffer` due to a bug in Node.js that returns a bigger ArrayBuffer causing memory overflow
- Updated dependencies
  [[`9b6911a`](https://github.com/ardatan/whatwg-node/commit/9b6911a8fca0fc046278a8b490e14eb4412da98f)]:
  - @whatwg-node/fetch@0.9.10

## 0.9.13

### Patch Changes

- [#786](https://github.com/ardatan/whatwg-node/pull/786)
  [`a254e88`](https://github.com/ardatan/whatwg-node/commit/a254e887d2102d29ff31df121c5f7ae5806c99c9)
  Thanks [@ardatan](https://github.com/ardatan)! - Handle query parameters correctly in uWS

## 0.9.12

### Patch Changes

- [#777](https://github.com/ardatan/whatwg-node/pull/777)
  [`e3ae0a3`](https://github.com/ardatan/whatwg-node/commit/e3ae0a37c6aae11b249ea3134feb4a55a0cd288c)
  Thanks [@ardatan](https://github.com/ardatan)! - Do not create a new Buffer to uWS and node-http,
  and use the existing Buffer instead for better performance in Node.js.

## 0.9.11

### Patch Changes

- [`4b67036`](https://github.com/ardatan/whatwg-node/commit/4b67036b1e84e43e103e7fe9b69d240a72be6e6d)
  Thanks [@ardatan](https://github.com/ardatan)! - Handle AbortSignal

## 0.9.10

### Patch Changes

- [#753](https://github.com/ardatan/whatwg-node/pull/753)
  [`10db17b`](https://github.com/ardatan/whatwg-node/commit/10db17bb041edbd5b5fe80120956d97f073e1bf2)
  Thanks [@ardatan](https://github.com/ardatan)! - Handle errors thrown in the request handlers as
  Internal Server Error

## 0.9.9

### Patch Changes

- [`11fb356`](https://github.com/ardatan/whatwg-node/commit/11fb3568885a60d2f63a8e599fa599a7fd1a4622)
  Thanks [@ardatan](https://github.com/ardatan)! - Avoid wrapping handleRequest if there is no hook

## 0.9.8

### Patch Changes

- [#741](https://github.com/ardatan/whatwg-node/pull/741)
  [`427b829`](https://github.com/ardatan/whatwg-node/commit/427b829356ddd9a0d009a37e066db658dad77ff2)
  Thanks [@ardatan](https://github.com/ardatan)! - Avoid promise usages while handling hooks for
  performance optimizations

## 0.9.7

### Patch Changes

- [#732](https://github.com/ardatan/whatwg-node/pull/732)
  [`0794ee5`](https://github.com/ardatan/whatwg-node/commit/0794ee52568bf15a1e1313a0121d324d4c510f80)
  Thanks [@ardatan](https://github.com/ardatan)! - If the environment is not able to send the
  response, do not terminate the server and handle internal errors in a better way

## 0.9.6

### Patch Changes

- [`5136050`](https://github.com/ardatan/whatwg-node/commit/5136050a48800e7cb2f41ba7df79945ff6f24ff6)
  Thanks [@ardatan](https://github.com/ardatan)! - For uWebSockets, call res.onAborted only if
  response is a stream

## 0.9.5

### Patch Changes

- [`633655d`](https://github.com/ardatan/whatwg-node/commit/633655d00b00992a3195c1a8aa0bdf27e07381b2)
  Thanks [@ardatan](https://github.com/ardatan)! - Cork the response once for status codes and
  headers with the static response in uWS handler

## 0.9.4

### Patch Changes

- [#694](https://github.com/ardatan/whatwg-node/pull/694)
  [`96ee8ce`](https://github.com/ardatan/whatwg-node/commit/96ee8ceb15307d5fed99190d9a2c95fd0f0a0449)
  Thanks [@ardatan](https://github.com/ardatan)! - Handle uWS onAbort in a better way

## 0.9.3

### Patch Changes

- [`6082626`](https://github.com/ardatan/whatwg-node/commit/608262642f9b2a1b0936ff223efb3cf982134bd3)
  Thanks [@ardatan](https://github.com/ardatan)! - Make sure we copy the buffer from uWS

## 0.9.2

### Patch Changes

- [`bc955e0`](https://github.com/ardatan/whatwg-node/commit/bc955e09cca71d93b8bf59c2dab9fd440d1a0193)
  Thanks [@ardatan](https://github.com/ardatan)! - Optimizations for setting headers to
  `ServerResponse`

## 0.9.1

### Patch Changes

- [#646](https://github.com/ardatan/whatwg-node/pull/646)
  [`2f25027`](https://github.com/ardatan/whatwg-node/commit/2f250274b9b4d895e1120dbeb185e820269ca7a6)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Internal adjustments for fixing Next.js support.

## 0.9.0

### Minor Changes

- [`124bbe5`](https://github.com/ardatan/whatwg-node/commit/124bbe55f125dc9248fdde9c7e86637d905739fe)
  Thanks [@ardatan](https://github.com/ardatan)! - BREAKING: splitSetCookieHeader has been removed.
  Use `Headers.getSetCookie` instead

### Patch Changes

- Updated dependencies
  [[`124bbe5`](https://github.com/ardatan/whatwg-node/commit/124bbe55f125dc9248fdde9c7e86637d905739fe)]:
  - @whatwg-node/fetch@0.9.7

## 0.8.12

### Patch Changes

- [`025613a`](https://github.com/ardatan/whatwg-node/commit/025613af57695c2158189156479129a461d758ce)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix cookie handling

## 0.8.11

### Patch Changes

- [`9920800`](https://github.com/ardatan/whatwg-node/commit/992080051bf91af76471984f546a5eb8d9116024)
  Thanks [@ardatan](https://github.com/ardatan)! - Handle empty server contexts

## 0.8.10

### Patch Changes

- [#614](https://github.com/ardatan/whatwg-node/pull/614)
  [`f07d1c5`](https://github.com/ardatan/whatwg-node/commit/f07d1c5af5d17d64a45162a23a755ae8ce11ac93)
  Thanks [@ardatan](https://github.com/ardatan)! - Performance optimizations

- [#614](https://github.com/ardatan/whatwg-node/pull/614)
  [`f07d1c5`](https://github.com/ardatan/whatwg-node/commit/f07d1c5af5d17d64a45162a23a755ae8ce11ac93)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix set-cookie handling for Node

- Updated dependencies
  [[`f07d1c5`](https://github.com/ardatan/whatwg-node/commit/f07d1c5af5d17d64a45162a23a755ae8ce11ac93)]:
  - @whatwg-node/fetch@0.9.6

## 0.8.9

### Patch Changes

- [#612](https://github.com/ardatan/whatwg-node/pull/612)
  [`273ca94`](https://github.com/ardatan/whatwg-node/commit/273ca94a35e0d4236d932e28f295f405d9adbd4c)
  Thanks [@ardatan](https://github.com/ardatan)! - Performance optimizations

- Updated dependencies
  [[`273ca94`](https://github.com/ardatan/whatwg-node/commit/273ca94a35e0d4236d932e28f295f405d9adbd4c)]:
  - @whatwg-node/fetch@0.9.5

## 0.8.8

### Patch Changes

- [`11cb454`](https://github.com/ardatan/whatwg-node/commit/11cb45441fb81fb9caeaeb286c5cef57aad64ee9)
  Thanks [@ardatan](https://github.com/ardatan)! - Handle multiple cookies correctly

- [`11cb454`](https://github.com/ardatan/whatwg-node/commit/11cb45441fb81fb9caeaeb286c5cef57aad64ee9)
  Thanks [@ardatan](https://github.com/ardatan)! - Handle headers in Node correctly

## 0.8.7

### Patch Changes

- [#597](https://github.com/ardatan/whatwg-node/pull/597)
  [`d118d53`](https://github.com/ardatan/whatwg-node/commit/d118d538f3ab75f87728c4c8373b5b53fb8e1d51)
  Thanks [@ardatan](https://github.com/ardatan)! - Performance optimizations

- Updated dependencies
  [[`d118d53`](https://github.com/ardatan/whatwg-node/commit/d118d538f3ab75f87728c4c8373b5b53fb8e1d51)]:
  - @whatwg-node/fetch@0.9.4

## 0.8.6

### Patch Changes

- [`72680b3`](https://github.com/ardatan/whatwg-node/commit/72680b30b07e14032c3a50f6705c11a81dc5f3da)
  Thanks [@ardatan](https://github.com/ardatan)! - More fixes for uWS

## 0.8.5

### Patch Changes

- [#592](https://github.com/ardatan/whatwg-node/pull/592)
  [`4cdb7c6`](https://github.com/ardatan/whatwg-node/commit/4cdb7c6851ccebec80576de584579709c8f23539)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix uWebSockets headers issue

## 0.8.4

### Patch Changes

- [`c0bef34`](https://github.com/ardatan/whatwg-node/commit/c0bef34154031ad2158f558107c168ee5c9c9084)
  Thanks [@ardatan](https://github.com/ardatan)! - Export more uWS helpers

## 0.8.3

### Patch Changes

- [`d7d9d9f`](https://github.com/ardatan/whatwg-node/commit/d7d9d9ff8903126eb3a346d35dcf621cafff1bd8)
  Thanks [@ardatan](https://github.com/ardatan)! - Bump internal packages

- Updated dependencies
  [[`d7d9d9f`](https://github.com/ardatan/whatwg-node/commit/d7d9d9ff8903126eb3a346d35dcf621cafff1bd8)]:
  - @whatwg-node/fetch@0.9.3

## 0.8.2

### Patch Changes

- [#583](https://github.com/ardatan/whatwg-node/pull/583)
  [`15bf7c2`](https://github.com/ardatan/whatwg-node/commit/15bf7c2dcee1ff30d0142b9fc4f030c53fa2ab43)
  Thanks [@ardatan](https://github.com/ardatan)! - dependencies updates:
  - Added dependency
    [`@repeaterjs/repeater@^3.0.4` ↗︎](https://www.npmjs.com/package/@repeaterjs/repeater/v/3.0.4)
    (to `dependencies`)

## 0.8.1

### Patch Changes

- [`102b437`](https://github.com/ardatan/whatwg-node/commit/102b4370c9ee3784297b3dae3f05a236490c6f46)
  Thanks [@ardatan](https://github.com/ardatan)! - Better uWebSockets.js integration

## 0.7.6

### Patch Changes

- Updated dependencies
  [[`01051f8`](https://github.com/ardatan/whatwg-node/commit/01051f8b3408ac26612b8d8ea2702a3f7e6667af),
  [`01051f8`](https://github.com/ardatan/whatwg-node/commit/01051f8b3408ac26612b8d8ea2702a3f7e6667af)]:
  - @whatwg-node/fetch@0.9.0

## 0.7.5

### Patch Changes

- [#434](https://github.com/ardatan/whatwg-node/pull/434)
  [`9f242f8`](https://github.com/ardatan/whatwg-node/commit/9f242f8268748345899ea4b6f05dac3c6dcecbeb)
  Thanks [@ardatan](https://github.com/ardatan)! - Update bob

- Updated dependencies
  [[`bf585a3`](https://github.com/ardatan/whatwg-node/commit/bf585a3b1cafa63bdee86dace6a0e08f98a9b554)]:
  - @whatwg-node/fetch@0.8.3

## 0.7.4

### Patch Changes

- [#403](https://github.com/ardatan/whatwg-node/pull/403)
  [`225b5fd`](https://github.com/ardatan/whatwg-node/commit/225b5fde78d53702fecb968cb2c8f7c113d41b47)
  Thanks [@ardatan](https://github.com/ardatan)! - Improvements

## 0.7.3

### Patch Changes

- [`3bac7e3`](https://github.com/ardatan/whatwg-node/commit/3bac7e375df861a2f7c5807731791dd3b863a9fe)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix regression on handling methods from base
  object

## 0.7.2

### Patch Changes

- [#380](https://github.com/ardatan/whatwg-node/pull/380)
  [`0df1ac7`](https://github.com/ardatan/whatwg-node/commit/0df1ac7d577ba831ce6431d68628b2028c37762f)
  Thanks [@ardatan](https://github.com/ardatan)! - If a method returns the object itself, return the
  adapter object

- Updated dependencies
  [[`0df1ac7`](https://github.com/ardatan/whatwg-node/commit/0df1ac7d577ba831ce6431d68628b2028c37762f)]:
  - @whatwg-node/fetch@0.8.2

## 0.7.1

### Patch Changes

- [`79428fd`](https://github.com/ardatan/whatwg-node/commit/79428fdfe52f897e1d3499c0068d18652cf5eccc)
  Thanks [@ardatan](https://github.com/ardatan)! - Remove `onPluginInit`

## 0.7.0

### Minor Changes

- [#264](https://github.com/ardatan/whatwg-node/pull/264)
  [`f5fa2d7`](https://github.com/ardatan/whatwg-node/commit/f5fa2d743fd06e4da7fa4c4e842d8c45bab9e047)
  Thanks [@ardatan](https://github.com/ardatan)! - Plugin System

- [`720b6ab`](https://github.com/ardatan/whatwg-node/commit/720b6ab110e7bf0cc36454abdc38d622e8f0c35f)
  Thanks [@ardatan](https://github.com/ardatan)! - BREAKING: `withCors` and `withErrorHandling` are
  removed in `server` and `plugins` option is removed in `router`

### Patch Changes

- [`7d94f60`](https://github.com/ardatan/whatwg-node/commit/7d94f60e7d08407a2b4a4e7b7d06bace31466e57)
  Thanks [@ardatan](https://github.com/ardatan)! - If the first parameter's request property throws,
  consider it as a Request

## 0.6.7

### Patch Changes

- [`c7b9c8a`](https://github.com/ardatan/whatwg-node/commit/c7b9c8a4f58926e923bb3f581cf145feb389880f)
  Thanks [@ardatan](https://github.com/ardatan)! - Fix handling search parameters

- Updated dependencies []:
  - @whatwg-node/fetch@0.8.1

## 0.6.6

### Patch Changes

- Updated dependencies
  [[`ea5d252`](https://github.com/ardatan/whatwg-node/commit/ea5d25298c480d4c5483186af41dccda8197164d)]:
  - @whatwg-node/fetch@0.8.0

## 0.6.5

### Patch Changes

- [#318](https://github.com/ardatan/whatwg-node/pull/318)
  [`390510b`](https://github.com/ardatan/whatwg-node/commit/390510b39d5d374233eb9798adbd0ef14101e2b7)
  Thanks [@ardatan](https://github.com/ardatan)! - Small optimizations

- Updated dependencies
  [[`390510b`](https://github.com/ardatan/whatwg-node/commit/390510b39d5d374233eb9798adbd0ef14101e2b7)]:
  - @whatwg-node/fetch@0.7.0

## 0.6.4

### Patch Changes

- [#314](https://github.com/ardatan/whatwg-node/pull/314)
  [`3aa1848`](https://github.com/ardatan/whatwg-node/commit/3aa18486d44c507617b25204c3d4a96bc8a4c9e4)
  Thanks [@ardatan](https://github.com/ardatan)! - dependencies updates:

  - Updated dependency
    [`@whatwg-node/fetch@^0.6.8` ↗︎](https://www.npmjs.com/package/@whatwg-node/fetch/v/0.6.8)
    (from `0.6.8`, in `dependencies`)

- [#314](https://github.com/ardatan/whatwg-node/pull/314)
  [`3aa1848`](https://github.com/ardatan/whatwg-node/commit/3aa18486d44c507617b25204c3d4a96bc8a4c9e4)
  Thanks [@ardatan](https://github.com/ardatan)! - Align versions with ranged dependencies and cross
  version support internally

- Updated dependencies
  [[`3aa1848`](https://github.com/ardatan/whatwg-node/commit/3aa18486d44c507617b25204c3d4a96bc8a4c9e4),
  [`3aa1848`](https://github.com/ardatan/whatwg-node/commit/3aa18486d44c507617b25204c3d4a96bc8a4c9e4)]:
  - @whatwg-node/fetch@0.6.9

## 0.6.3

### Patch Changes

- Updated dependencies []:
  - @whatwg-node/fetch@0.6.8

## 0.6.2

### Patch Changes

- [#311](https://github.com/ardatan/whatwg-node/pull/311)
  [`8edd68d`](https://github.com/ardatan/whatwg-node/commit/8edd68d288889e7a1222c8790a708b0930f337e2)
  Thanks [@ardatan](https://github.com/ardatan)! - Performance improvements

- Updated dependencies []:
  - @whatwg-node/fetch@0.6.7

## 0.6.1

### Patch Changes

- [#308](https://github.com/ardatan/whatwg-node/pull/308)
  [`9c58f3e`](https://github.com/ardatan/whatwg-node/commit/9c58f3e6bf2248fdf8ee3482928a415339b040fa)
  Thanks [@ardatan](https://github.com/ardatan)! - Do not configure the socket for long live
  connection

## 0.6.0

### Minor Changes

- [`972f781`](https://github.com/ardatan/whatwg-node/commit/972f781b040a28e23eb1b6f1f5140858abf011ff)
  Thanks [@ardatan](https://github.com/ardatan)! - Relax typings for Node frameworks

### Patch Changes

- Updated dependencies []:
  - @whatwg-node/fetch@0.6.6

## 0.5.11

### Patch Changes

- Updated dependencies
  [[`63c96f5`](https://github.com/ardatan/whatwg-node/commit/63c96f5ad14bbc56ccccb95def3447b4107f6013)]:
  - @whatwg-node/fetch@0.6.5

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
    return new Response(`I got ${req.url}`)
  })
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
