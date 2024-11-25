---
'@whatwg-node/server': minor
---

New Explicit Resource Management feature for the server adapters;
[Learn more](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html)
- `Symbol.dispose` and `Symbol.asyncDispose` hooks
When the server adapter plugin has these hooks, it is added to the disposable stack of the server adapter. When the server adapter is disposed, those hooks are triggered
- `disposableStack` in the server adapter
The shared disposable stack that will be triggered when `Symbol.asyncDispose` is called.
- Automatic disposal on Node and Node-compatible environments
Even if the server adapter is not disposed explicitly, the disposal logic will be triggered on the process termination (SIGINT, SIGTERM etc)
- ctx.waitUntil relation
If it is an environment does not natively provide `waitUntil`, the unresolved passed promises will be resolved by the disposable stack.