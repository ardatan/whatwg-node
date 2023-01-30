# WhatWG Node

This repository contains a set of environment(Browser, Node.js, Deno, Cloudflare Workers, Bun, etc.)
agnostic packages for the [WhatWG](https://whatwg.org) standards.

Node.js currently is the only exception that doesn't fully support those standards so `whatwg-node`
packages ponyfill the missing parts without modifying or monkey-patching the native global APIs like
polyfills.

> Polyfill patches the native parts of an environment while ponyfill just exports the “patched”
> stuff without touching the environment’s internals. We prefer pony filling because it prevents us
> from breaking other libraries and environmental functionalities. In case a ponyfill is imported in
> an environment that already has that API built in like newer Node.js, Cloudflare Workers, Bun,
> Deno or Browser, no ponyfills are added to your built application bundle. So you have a generic
> package that works in all environments.

## Packages

### [@whatwg-node/fetch](./packages/fetch)

A ponyfill package for the [Fetch Standard](https://fetch.spec.whatwg.org/).

### [@whatwg-node/events](./packages/events)

A ponyfill package for the [DOM Events Standard](https://dom.spec.whatwg.org/#events).

### [@whatwg-node/server](./packages/server)

A platform-independent JavaScript HTTP server adapter implementation that uses the
[Fetch Standard](https://fetch.spec.whatwg.org/) to handle requests. The HTTP server implemented
with this library can be used in any JS environment like Node.js, Deno, Cloudflare Workers, Bun,
etc. For Node.js, it transpiles Node.js specific APIs to the standard ones, and for other
environments, it uses the standard APIs directly. Even if your environment doesn't use Fetch API for
the server implementation, you can still use `fetch` method to handle requests.

### [@whatwg-node/router](./packages/router)

A platform-independent JavaScript HTTP router that uses the
[URL Standard](https://url.spec.whatwg.org/) and [Fetch Standard](https://fetch.spec.whatwg.org/) to
match requests to handlers. The HTTP router implemented with this library can be used in any JS
environment like Node.js, Deno, Cloudflare Workers, Bun, etc. It uses
[@whatwg-node/server](./packages/server) and
[URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) specifically.

### [fetchache](./packages/fetchache)

A fetch wrapper that allows you to respect HTTP caching strategies on non-browser environments with
a key-value cache implementation. It follows the [HTTP Caching](https://tools.ietf.org/html/rfc7234)
and [Conditional Requests](https://tools.ietf.org/html/rfc7232) standards.
