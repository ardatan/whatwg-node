---
'@whatwg-node/server': minor
---

Request handlers take the incoming `Request` and the server context. The Fetch API is no longer a third argument.

`ServerAdapterRequestHandler` is now `(request, ctx) => MaybePromise<Response>`. `ctx` is `TServerContext & ServerAdapterInitialContext`. That initial context still has `waitUntil`, and it now also has:

- `request`: the `Request` being handled
- `fetchAPI`: the WHATWG Fetch API implementation for that request (`Request`, `Response`, `URL`, and the rest of the surface returned by `createFetch`)

`WaitUntilFn` is typed as `(promise: MaybePromise<void>) => void`. A non-promise value is ignored. A promise is retained until it settles, including through disposal when `disposeOnProcessTerminate` is set, so it does not surface as an unhandled rejection.

The adapter fills `request`, `fetchAPI`, and `waitUntil` when the caller did not:

- Node (`requestListener` and `handleNodeRequestAndResponse`) sets `waitUntil` and `fetchAPI` to the adapter's Fetch API, then sets `request` to the normalized Node request. `ServerAdapterNodeContext` extends `ServerAdapterInitialContext`, so a Node context includes `req`, `res`, `waitUntil`, `request`, and `fetchAPI`.
- uWebSockets.js does the same on the context that already carries `req` and `res`.
- `fetch` and `handleRequest` build one isolated context. With a single caller context (or none), that object prototypes the caller context and defines `waitUntil` (the caller's, or the adapter's), `request`, and `fetchAPI`. `fetchAPI` is the caller's when present. Otherwise it follows the `Request` constructor: the adapter's Fetch API when the request was created with it, the runtime's native Fetch API when the request is a global `Request`, and the adapter's Fetch API for any other constructor. Several caller contexts are merged with `completeAssign` and are not given these fields again.

A `FetchEvent` with no extra context is isolated the same way, with the event as the prototype. The handler is invoked as `handleRequest(event.request, serverContext)`. Extra context objects are assigned onto the event. `respondWith` still receives the handler's response.

Caller context objects are not mutated. `isolateObject` now takes one options object, `{ originalCtx, waitUntil?, request?, fetchAPI? }`, instead of `(originalCtx, waitUntil?)`. It returns `Object.create(originalCtx)` (or a fresh object when `originalCtx` is missing) with those fields copied on as own properties. Writes on the returned object stay off the caller's object. `isolateObject` remains a public export.

`onRequest` and `onResponse` hooks still receive `fetchAPI` on the hook payload. `serverContext` on both payloads is now `TServerContext & ServerAdapterInitialContext`, so a hook can also read `request` and `fetchAPI` from the context. Wrapped handlers installed with `setRequestHandler` use the same `(request, serverContext)` signature. `useErrorHandling` still passes `fetchAPI` into the error callback. `useRequestDeadline` no longer forwards `fetchAPI` into the wrapped handler; the deadline response factory still receives `(request, ctx)`.

Instrumentation wraps that same two-argument handler.

Call `ctx.fetchAPI` instead of a third handler argument. `isolateObject(ctx, waitUntil)` becomes `isolateObject({ originalCtx: ctx, waitUntil, request, fetchAPI })`.
