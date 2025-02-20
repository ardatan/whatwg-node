---
'@whatwg-node/fetch': patch
'@whatwg-node/node-fetch': patch
---

Fix the bug when `set-cookies` given is ignored in `HeadersInit`;

```js
import { Headers } from '@whatwg-node/fetch';

const headers = new Headers([
    ['set-cookie', 'a=b'],
    ['set-cookie', 'c=d'],
]);
expect(headers.getSetCookie()).toEqual(['a=b', 'c=d']); // Previously it was empty
```