---
'@whatwg-node/node-fetch': patch
---

Fix HTTPS verification for IPv6 address literals in the node-http ponyfill.

Work around a Node.js regression (`tls.checkServerIdentity` + `domainToASCII`) that rejects valid `IP Address` SANs for hosts like `::1` on Node.js 22.23+ / 24.17+ (https://github.com/nodejs/node/issues/64032).

The override is installed only when a one-time probe shows the running Node build is affected; healthy Node versions keep the built-in verifier.
