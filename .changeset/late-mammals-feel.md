---
'@whatwg-node/server': minor
---

New `useRequestDeadline` plugin for enforcing per-request timeouts

Aborts the request signal and returns a custom response when the handler takes longer than the
configured timeout.

```ts
import { createServerAdapter, useRequestDeadline } from '@whatwg-node/server'

const adapter = createServerAdapter(myHandler, {
  plugins: [
    useRequestDeadline({
      timeout: 5000,
      response: req => new Response(`Request to ${req.url} timed out`, { status: 504 })
    })
  ]
})
```

The request's `AbortSignal` is aborted when the deadline fires, so handlers that respect it (e.g.
`fetch` calls, database queries) are cancelled cooperatively:

```ts
async function myHandler(req: Request) {
  // this fetch is cancelled automatically if the deadline fires
  const data = await fetch('https://slow-api.example.com/data', { signal: req.signal })
  return Response.json(await data.json())
}
```
