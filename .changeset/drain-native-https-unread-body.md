---
'@whatwg-node/server': patch
---

Drain unread request bodies correctly when the adapter uses the platform (native undici) `Request` on Node.js HTTPS.

`discardUnreadNodeRequestBody` previously only called `IncomingMessage#resume()`. That is enough for the `@whatwg-node/node-fetch` ponyfill and for plain `node:http`, but native undici keeps an unused `IncomingMessage` body **paused**. On `node:https` the TLS upload then stalls mid-response: `readableFlowing` stays false, buffered unread bytes remain, and keep-alive / early-response paths hang or fail Node 26 unit coverage (`discard-unread-request-body`).

For `fetchAPI.Request === globalThis.Request`, `normalizeNodeRequest` now wraps the socket stream in a platform `ReadableStream` (via `fetchAPI.ReadableStream`) whose `cancel()` resumes the real `IncomingMessage`. Discard cancels that body and resumes, so unread bytes drain without destroying the keep-alive socket and without adding a runtime `node:stream` / `PassThrough` import. Ponyfill requests are unchanged (still use the `IncomingMessage` directly, and ponyfill `body.cancel()` is still avoided because it can RST the connection). Paths that reuse `request.body` as the response body still skip discard via the existing identity checks.
