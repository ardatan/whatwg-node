---
'@whatwg-node/node-fetch': patch
---

Fix the error thrown \`ENOTFOUND\` when a parsed URL with IPV6 hostname is given

Instead of using the parsed URL passed to the `fetch` function, let `node:http` parse it again. This way, the IPV6 hostname is correctly resolved.
