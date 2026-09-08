---
'@whatwg-node/promise-helpers': major
---

**Breaking Change:** Remove deprecated `mapMaybePromise` in favor of `handleMaybePromise`.

`mapMaybePromise(input, onSuccess, onError?)` is gone. Use `handleMaybePromise`, which takes an **input factory** (thunk) instead of a bare value so sync throws are handled the same way as promise rejections.

**Before:**

```ts
import { mapMaybePromise } from '@whatwg-node/promise-helpers'

const result = mapMaybePromise(
  maybeValue,
  value => transform(value),
  err => fallback(err),
)
```

**After:**

```ts
import { handleMaybePromise } from '@whatwg-node/promise-helpers'

const result = handleMaybePromise(
  () => maybeValue,
  value => transform(value),
  err => fallback(err),
)
```

`handleMaybePromise` also accepts an optional fourth `finallyFactory` argument if you need cleanup.
