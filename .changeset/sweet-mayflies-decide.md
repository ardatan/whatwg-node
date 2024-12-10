---
'@whatwg-node/node-fetch': patch
---

Fix IPV6 parsing in \`URL\`;

`new URL('http://[::1]')` should parse the host as \`[::1]\` not \`::1\`.
