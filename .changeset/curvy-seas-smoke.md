---
'@whatwg-node/fetch': patch
'@whatwg-node/server': patch
'@whatwg-node/node-fetch': patch
---

Performance optimizations for Node 24

- Use `once` from `node:events` for Promise-based event handling whenever
possible
- Avoid creating `AbortController` and `AbortSignal` if not needed with `new Request` because it is expensive
- Avoid creating a map for `Headers` and try to re-use the init object for `Headers` for performance with a single-line `writeHead`.
- Avoid creating `Buffer` for `string` bodies for performance
- Use `setHeaders` which accepts `Headers` since Node 18 if needed to forward `Headers` to Node