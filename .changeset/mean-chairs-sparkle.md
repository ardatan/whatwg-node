---
'@whatwg-node/server': patch
---

Disposal logic for server adapter;

For long running environments such as Node etc, all promises passed to `ctx.waitUntil` should be awaited to prevent memory leaks in case of process termination.

Server Adapter is now `AsyncDisposable` which awaits all promises passed to `ctx.waitUntil` before disposing.

Server Adapter also provides `disposableStack` which is a stack of disposables that are disposed when the server adapter is disposed.