---
'@whatwg-node/node-fetch': patch
---

# Fixes for usage of `node-libcurl`

- Fix \`Error: SSL peer certificate or SSH remove key was not ok error\`, and use `tls.rootCertificates` as default certificates.

[Learn more](https://github.com/JCMais/node-libcurl/blob/develop/COMMON_ISSUES.md)

- Fix `API function called from within callback` by preventing the use of `curl_easy_perform` and `curl_multi_perform` inside callbacks.