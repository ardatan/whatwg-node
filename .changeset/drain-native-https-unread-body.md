---
'@whatwg-node/server': patch
---

Drain unread request bodies correctly when the adapter uses the platform (native undici) `Request` on Node.js HTTPS.

`discardUnreadNodeRequestBody` previously only called `IncomingMessage#resume()`. That is enough for the `@whatwg-node/node-fetch` ponyfill and for plain `node:http`, but native undici keeps an unused `IncomingMessage` body **paused**. On `node:https` the TLS upload then stalls mid-response: `readableFlowing` stays false, buffered unread bytes remain, and keep-alive / early-response paths hang or fail Node 26 unit coverage (`discard-unread-request-body`).

For `fetchAPI.Request === globalThis.Request` on **HTTPS** (`socket.encrypted`), `normalizeNodeRequest` wraps the socket stream in a platform `ReadableStream` (via `fetchAPI.ReadableStream`). Listeners attach on first pull; discard runs a sync drain helper (detach + `IncomingMessage#resume`) instead of `body.cancel()`, so unread TLS bytes drain without destroying keep-alive and without a runtime `node:stream` / `PassThrough` import or a floating cancel promise. Plain HTTP and ponyfill paths are unchanged (`IncomingMessage` + `resume()` only). Paths that reuse `request.body` as the response body still skip discard via the existing identity checks.
