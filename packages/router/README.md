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

### Basic Routing

```ts
// Then use it in any environment
import { createServer } from 'http'
import { createRouter, Router } from '@whatwg-node/router'

const router = createRouter()
// GET collection index
router.get('/todos', () => new Response('Todos Index!'))
// GET item
router.get('/todos/:id', ({ params }) => new Response(`Todo #${params.id}`))
// POST to the collection (we'll use async here)
router.post('/todos', async request => {
  const content = await request.json()
  return new Response('Creating Todo: ' + JSON.stringify(content))
})

// Redirect to a URL
router.get('/google', () => Response.redirect('http://www.google.com'))

// 404 for everything else
router.all('*', () => new Response('Not Found.', { status: 404 }))

const httpServer = createServer(router)
httpServer.listen(4000)
```

## Example

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
`try/catch` method to handle errors. Or you can use the plugins to handle errors like below.

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

## Plugins to handle CORS, cookies and more

This library also provides a plugin system that allows you hook into the request/response lifecycle.

- `onRequest` - Called before the request is handled by the router
- - It has `endResponse` method that accepts a `Response` object to short-circuit the request
- `onResponse` - Called after the request is handled by the router
- - It allows you to modify the response before it is sent to the client

### Cookie Management

You can use `useCookies` to parse cookies from the request header and set cookies in the response by using Web Standard [CookieStore](https://developer.mozilla.org/en-US/docs/Web/API/CookieStore).

```ts
import { createRouter, useCookies, Response } from '@whatwg-node/router'

const router = createRouter({
  plugins: [
    useCookies()
  ]
})

router.get('/me', async req => {
  const sessionId = await request.cookieStore.get('session_id')
  if (!sessionId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = await getUserBySessionId(sessionId)
  return Response.json(user)  
})

router.post('/login', async req => {
  const { username, password } = await req.json()
  const sessionId = await createSessionForUser({ username, password })
  await request.cookieStore.set('session_id', sessionId)
  return Response.json({ message: 'ok' })
})
```

### CORS Management

You can also setup a CORS middleware to handle preflight CORS requests.

```ts
import { useCORS, createRouter } from '@whatwg-node/router'

const router = createRouter({
  plugins: [
    useCORS({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      headers: ['Content-Type', 'Authorization']
    })
  ]
})
```

### Custom plugins

You can also create your own plugins to handle errors, logging, etc.

```ts
import { createRouter } from '@whatwg-node/router'

const useRequestId = (): RoutePlugin => {
  return {
    onRequest({ request, fetchAPI }) {
      let requestId = request.headers.get('X-Request-ID')
      if (!requestId) {
        requestId = fetchAPI.crypto.randomUUID()
        request.headers.set('X-Request-ID', requestId)
      }
    },
    onResponse({ response, fetchAPI }) {
      response.headers.set('X-Request-ID', request.headers.get('X-Request-ID'))
    }
  }
}

const router = createRouter({
  plugins: [
    useRequestId(),
  ]
})
```

## Type Safety with TypeScript, JSON Schema and OpenAPI

This library is written in TypeScript and it provides type safety for your request and response with the power of JSON Schema.

To define type-safe routes, we use `addRoute` method with specific parameters.

#### Typing the request

You can type individual parts of the `Request` object including JSON body, headers, query parameters, and URL parameters.

##### JSON Body
```ts
import { createRouter, Response } from '@whatwg-node/router'

const router = createRouter()

router.addRoute({
  method: 'post',
  path: '/todos',
  // Define the request body schema
  schemas: {
    Request: {
      JSONBody: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          completed: { type: 'boolean' }
        },
        additionalProperties: false,
        required: ['title']
      },
    }
  }
}, async request => {
  // This part is fully typed
  const { title, completed } = await request.json()
  // ...
  return Response.json({ message: 'ok' })
})
```

##### Headers

```ts
import { createRouter, Response } from '@whatwg-node/router'

const router = createRouter()

router.addRoute({
  method: 'post',
  path: '/todos',
  // Define the request body schema
  schemas: {
    Request: {
      Headers: {
        type: 'object',
        properties: {
          'x-api-key': { type: 'string' }
        },
        additionalProperties: false,
        required: ['x-api-key']
      },
    }
  }
}, async request => {
  // This part is fully typed
  const apiKey = request.headers.get('x-api-key')
  // Would fail on TypeScript compilation
  const wrongHeaderName = request.headers.get('x-api-key-wrong')
  // ...
  return Response.json({ message: 'ok' })
})
```

##### Path Parameters

```ts
import { createRouter, Response } from '@whatwg-node/router'

const router = createRouter()

router.addRoute({
  method: 'get',
  path: '/todos/:id',
  // Define the request body schema
  schemas: {
    Request: {
      PathParams: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        additionalProperties: false,
        required: ['id']
      },
    }
  }
}, async request => {
  // This part is fully typed
  const { id } = request.params
  // ...
  return Response.json({ message: 'ok' })
})
```

##### Query Parameters

```ts
import { createRouter, Response } from '@whatwg-node/router'

const router = createRouter()

router.addRoute({
  method: 'get',
  path: '/todos',
  // Define the request body schema
  schemas: {
    Request: {
      QueryParams: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
          offset: { type: 'number' }
        },
        additionalProperties: false,
        required: ['limit']
      },
    }
  }
}, async request => {
  // This part is fully typed
  const { limit, offset } = request.query
  // You can also use `URLSearchParams` API
  const limit = request.parsedURL.searchParams.get('limit')
  // ...
  return Response.json({ message: 'ok' })
})
```

#### Typing the response

You can also type the response body by the status code. We strongly recommend to explicitly define the status codes.

```ts
import { createRouter, Response } from '@whatwg-node/router'

const router = createRouter()

router.addRoute({
  method: 'get',
  path: '/todos',
  // Define the request body schema
  schemas: {
    Request: {
      Headers: {
        type: 'object',
        properties: {
          'x-api-key': { type: 'string' }
        },
        additionalProperties: false,
        required: ['x-api-key']
      }
    },
    Response: {
      200: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            completed: { type: 'boolean' }
          },
          additionalProperties: false,
          required: ['id', 'title', 'completed']
        }
      },
      401: {
        type: 'object',
        properties: {
          message: { type: 'string' }
        },
        additionalProperties: false,
        required: ['message']
      }
    }
  }
}, async request => {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey) {
    return Response.json({ message: 'API key is required' }, {
      status: 401
    })
  }
  const todos = await getTodos({
    apiKey
  })
  // This part is fully typed
  return Response.json(todos, {
    status: 200
  })
})
```

## Usage in environments

`Router` is actually an instance of `ServerAdapter` of `@whatwg-node/server` package. So you can use
it in any environment just like `ServerAdapter`. See the [documentation](../server/README.md) of
`@whatwg-node/server` package for more information.

