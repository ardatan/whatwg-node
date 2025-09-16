# Fetchache

A fetch wrapper that allows you to respect HTTP caching strategies on non-browser environments with
a key-value cache implementation. It follows the [HTTP Caching](https://tools.ietf.org/html/rfc7234)
and [Conditional Requests](https://tools.ietf.org/html/rfc7232) standards.

## Installation

```bash
npm install fetchache
```

## Usage

```ts
import { fetchFactory } from 'fetchache'
import { fetch, Response } from 'some-fetch-impl'

// We recommend using `@whatwg-node/fetch`

const someCacheImpl = {
  get: async key => {
    // Get the cached value from your cache implementation
  },
  set: async (key, value) => {
    // Set the cached value to your cache implementation
  }
}

const fetchWithCache = fetchFactory({
  fetch,
  Response,
  cache
})

// Then you can use it like a normal fetch
const response = await fetchWithCache('https://example.com')
```
