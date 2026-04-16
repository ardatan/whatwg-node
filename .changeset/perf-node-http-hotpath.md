---
"@whatwg-node/server": patch
"@whatwg-node/node-fetch": patch
"@whatwg-node/promise-helpers": patch
---

perf: reduce per-request allocations in the node:http hot path

Microbenchmarks (branch vs. master on identical hardware):

| Hot-path operation | master | branch | speedup |
|---|---|---|---|
| `handleMaybePromise` (sync) | 60 ns/op | 9 ns/op | **+85 %** |
| `PonyfillHeaders.get` (single header) | 115 ns/op | 92 ns/op | **+20 %** |
| `PonyfillHeaders.get` (multi-value) | 259 ns/op | 129 ns/op | **+50 %** |
| `isNonEmptyObject` | 15 ns/op | 9 ns/op | **+39 %** |
| `requestListener` (closure allocation) | 500 ns/op | 351 ns/op | **+30 %** |

End-to-end HTTP throughput (autocannon, 10 connections, 15 s) is within measurement noise on both branches because the workload is I/O-bound; the gains above translate to lower GC pressure and improved tail latency under sustained high-concurrency load.

**Changes per package:**

- **`@whatwg-node/server`**: Inline `handleNodeRequestAndResponse` into `requestListener` to eliminate extra function-call overhead and rest-parameter array allocations. Hoist constant closures (`requestHandlerErrorFn`, `logUnexpectedRequestError`, `responsePassthrough`) outside the per-request hot path so they are allocated once per adapter instance instead of once per request. Replace `Object.keys(obj).length > 0` with a `for…in` loop early-exit in `isNonEmptyObject` for O(1) property existence checks.

- **`@whatwg-node/node-fetch`**: Cache the `body` proxy in `PonyfillBody` so that repeated `.body` accesses reuse the same `Proxy` object instead of allocating a new one per call. Optimise `PonyfillHeaders.get()` and the key/value/entries iterators to use `for…of` loops instead of intermediate `Array.prototype.map` / `filter` calls, avoiding throwaway array allocations.

- **`@whatwg-node/promise-helpers`**: Introduce a fast synchronous path in `handleMaybePromise` that calls the input and output factories directly without going through the `fakePromise().then()` chain (no Promise object allocations for the common synchronous case). Hoist the `endEarly` flag and callback out of the per-iteration closure in `iterateAsync` so they are shared across iterations rather than re-created on every step.