---
"@whatwg-node/server": patch
---

Ensure unique context objects are sent per each request.

For example in CloudFlare Workers,
`fetch` receives `env` and `ctx`, and `env` is shared across requests. That causes the server receives the same context object for each request.
Now the server creates a new context object for each request, even if the first argument is the same. Before, it always takes the first argument as the context object, then merges the following arguments into it.