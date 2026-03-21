---
"@whatwg-node/server": patch
"@whatwg-node/node-fetch": patch
"@whatwg-node/promise-helpers": patch
---

perf: reduce per-request allocations in the node:http hot path

- **`@whatwg-node/server`**: Inline `handleNodeRequestAndResponse` into `requestListener` to eliminate extra function-call overhead and rest-parameter array allocations. Hoist constant closures (`requestHandlerErrorFn`, `logUnexpectedRequestError`, `responsePassthrough`) outside the per-request hot path so they are allocated once per adapter instance instead of once per request. Replace `Object.keys(obj).length > 0` with a `for…in` loop early-exit in `isNonEmptyObject` for O(1) property existence checks.

- **`@whatwg-node/node-fetch`**: Cache the `body` proxy in `PonyfillBody` so that repeated `.body` accesses reuse the same `Proxy` object instead of allocating a new one per call. Optimise `PonyfillHeaders.get()` and the key/value/entries iterators to use `for…of` loops instead of intermediate `Array.prototype.map` / `filter` calls, avoiding throwaway array allocations.

- **`@whatwg-node/promise-helpers`**: Introduce a fast synchronous path in `handleMaybePromise` that calls the input and output factories directly without going through the `fakePromise().then()` chain (no Promise object allocations for the common synchronous case). Hoist the `endEarly` flag and callback out of the per-iteration closure in `iterateAsync` so they are shared across iterations rather than re-created on every step.
