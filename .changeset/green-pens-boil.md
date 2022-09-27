---
'@whatwg-node/fetch': patch
'@whatwg-node/server': patch
---

- On Node 14, fix the return method of Response.body's AsyncIterator to close HTTP connection correctly
- On Node 14, handle ReadableStream's cancel correctly if Response.body is a ReadableStream
- Do not modify ReadableStream.cancel's behavior but handle it internally
- On Node 18, do not combine Response.body's return and AbortController which causes a memory leak
