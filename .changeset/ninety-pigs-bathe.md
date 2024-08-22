---
'@whatwg-node/node-fetch': patch
---

When cURL is used as the HTTP client implementation instead of node:http,
`SSL_VERIFYPEER` should be set `false` when the `NODE_TLS_REJECT_UNAUTHORIZED` environment variable is set to `0`.
`CAINFO` should be set to the value of the `NODE_EXTRA_CA_CERTS` environment variable.

This allows the cURL client to use the same CA certificates and SSL configuration as `node:http`