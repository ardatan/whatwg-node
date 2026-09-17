---
'@whatwg-node/server': patch
---

Fix native `Request` handling in the server adapter and pass the active fetch implementation to the request handler and plugins.

When a request originated from the runtime's native `Request` implementation, the server adapter could still use the ponyfill/default Fetch API during later pipeline stages. That could lead to mismatched `Request` / `Response` constructors and inconsistent behavior across runtimes such as Node, Bun, and Deno.
For example in Next.js, the incoming request object is the native Request while the returning `Response` object is ponyfilled which causes an error since Next.js expects it to be a native `Response` object.
As a workaround, you had to provide `fetchAPI: { Response }` on your own.
With this patch, this workaround is no longer needed.

- Native `Request` instances are now detected correctly and routed through the matching runtime fetch API.
- The request pipeline keeps using the correct `Request`, `Response`, and stream constructors for the active runtime.
- `useErrorHandling()` now passes the resolved `fetchAPI` into custom error handlers so they can construct responses with the correct runtime primitives.
- Request handlers now takes `fetchAPI` as a third argument, so that you don't need to worry about which fetch implementation to take.

```ts
createServerAdapter((request, context, fetchAPI) => fetchAPI.Response.json())
```

This keeps adapter behavior consistent and avoids subtle incompatibilities when handling native requests or custom fetch implementations.

It also avoids issues like this in GraphQL Yoga -> https://github.com/graphql-hive/graphql-yoga/issues/4583
So that the `TransformStream` implementation given by `fetchAPI` will be compatible with the given `request` instance automatically.
