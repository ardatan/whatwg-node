# Platform agnostic JavaScript HTTP Router

[![npm version](https://badge.fury.io/js/%40whatwg-node%2Frouter.svg)](https://badge.fury.io/js/%40whatwg-node%2Frouter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`@whatwg-node/router` is a package that allows you to create modern JavaScript HTTP router with the
WHATWG Fetch API that works in any JavaScript environment including Node.js, Deno, Bun, Cloudflare
Workers, Next.js, Fastify, Express, AWS Lambdas and even in browsers.

## Installation

```bash
yarn add @whatwg-node/router
```

## Why should I use this package instead of other packages like `itty-router`, `express` or `fastify`?

There are many packages out there that allow you to create HTTP routers, but they are not platform
agnostic. They are only for Node.js or only for those specific environments. But if you use this
package, your router will work in any environment that uses JavaScript.

## Usage

It follows the similar pattern to the `express` package, so basically you create a `Router` instance
and extend it with routers by using the HTTP methods like `get`, `post`, `put`, `patch`, `delete`,
`head` and `options`. And there is also `all` method that allows you to match all HTTP methods.

The first argument of these methods is the url pattern, and the following functions are handlers or
middlewares that will be called when the request matches the pattern.

> Note: The url pattern is a string that follows the
> [URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) standard. You can learn
> more about URL patterns
> [here](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern/URLPattern#matching_a_pathname).

`Router` gives you an extended version of the regular `Request` object that has the following
properties:

- `request.params`: An object that contains the parameters that are given in the url pattern.
- `request.query`: An object that contains the query parameters that are given in the url.

Let's create a basic REST API that manages users.

```ts
import { createRouter, Response } from '@whatwg-node/router'

const router = createRouter()

const users = [
  { id: '1', name: 'John' },
  { id: '2', name: 'Jane' }
]

router.get('/users', request => Response.json(users))

// Parameters are given in the `request.params` object
router.get('/users/:id', request => {
  const user = users.find(user => user.id === request.params.id)

  if (!user) {
    return new Response(null, {
      status: 404
    })
  }

  return Response.json(user)
})

router.delete('/users/:id', request => {
  const user = users.find(user => user.id === request.params.id)

  if (!user) {
    return new Response(null, {
      status: 404
    })
  }

  users.splice(users.indexOf(user), 1)

  return new Response(null, {
    status: 204
  })
})

// Handle JSON bodies
router.put('/users', async request => {
  const body = await request.json()

  const user = {
    id: String(users.length + 1),
    name: body.name
  }

  users.push(user)

  return Response.json(user)
})

// Handle both parameters and JSON body
router.post('/users/:id', async request => {
  const user = users.find(user => user.id === request.params.id)

  if (!user) {
    return new Response(null, {
      status: 404
    })
  }

  const body = await request.json()

  user.name = body.name

  return Response.json(user)
})
```

## Middlewares

You can also use middlewares to handle requests. Middlewares are functions that are called before
the request is handled by the router. You can use them to handle authentication, logging, etc.

If a handler function doesn't return a `Response` object, the request will be passed to the next
handler.

```ts
// In the following example, we are checking if the request has an `Authorization` header.
router.all('*', request => {
  if (!request.headers.get('Authorization')) {
    return new Response(null, {
      status: 401
    })
  }
})
router.get('/users', request => {
  // It doesn't reach here if the request doesn't have an `Authorization` header.
})
```

### Handler chaining

You can also chain multiple handlers to a single route. In the following example, we are checking if
the request has an `Authorization` header and if the user is an admin.

```ts
import { RouteHandler } from '@whatwg-node/router'

const withAuth: RouteHandler = request => {
  if (!request.headers.get('Authorization')) {
    return new Response(null, {
      status: 401
    })
  }
}

router.get('/users', withAuth, request => {
  // It doesn't reach here if the request doesn't have an `Authorization` header.
})
```

## Error handling

If an unexpected error is thrown, the response will have a `500` status code. You can use the
`try/catch` method to handle errors.

```ts
router.get('/users', request => {
  try {
    // Do something
  } catch (error) {
    return new Response('I handled the error gracefully', {
      status: 500
    })
  }
})
```

## Usage in environments

`Router` is actually an instance of `ServerAdapter` of `@whatwg-node/server` package. So you can use
it in any environment just like `ServerAdapter`. See the [documentation](../server/README.md) of
`@whatwg-node/server` package for more information.
