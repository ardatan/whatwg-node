# Platform agnostic fully type-safe JavaScript HTTP Router

[![npm version](https://badge.fury.io/js/%40whatwg-node%2Frouter.svg)](https://badge.fury.io/js/%40whatwg-node%2Frouter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`@whatwg-node/router` is a package that allows you to create modern JavaScript HTTP router with the
WHATWG Fetch API that works in any JavaScript environment including Node.js, Deno, Bun, Cloudflare
Workers, Next.js, Fastify, Express, AWS Lambdas and even in browsers.

It also allows you to create end-to-end type-safe and validated HTTP APIs with JSON Schema without
**ANY CODE GENERATION**.

## Installation

```bash
yarn add @whatwg-node/router
```

## Why should I use this package instead of other packages like `itty-router`, `express` or `fastify`?

There are many packages out there that allow you to create HTTP routers, but they are not platform
agnostic. They are only for Node.js or only for those specific environments. But if you use this
package, your router will work in any environment that uses JavaScript.

## Why should I use this package instead of tRPC?

tRPC doesn't need a code generation like this library, but this library allows you export an OpenAPI
document based on the JSON Schema definitions if you don't want to share TypeScript definitions
between the client and the server. And this library uses [JSON Schema](https://json-schema.org/)
instead of a programmatic schema solution like zod which is more portable and has bigger ecosystem.
So even if you don't want to write JSON Schemas manually, you can use `@sinclair/typebox` to
generate them by using an API like `zod` has.

## Usage

It uses `.route()` method to add routes to the router with the following parameters;

- `method`: The HTTP method of the request. This is optional and it handles all methods if it's not
  given.
- `path`: The URL pattern that the request should match. The url pattern is a string that follows
  the [URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) standard. You can
  learn more about URL patterns
  [here](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern/URLPattern#matching_a_pathname).
- `schemas`: An object that contains the schemas for the request and response. This brings a
  type-safety and validation to your requests and responses. You can learn more about schemas
  [here](#end-to-end-type-safety-and-validation-with-json-schema).
- `handler`: The function that will be called when the request matches the given method and path.
  This function can be either synchronous or asynchronous. If it's asynchronous, it should return a
  `Promise` that resolves to a `Response` object.

`Router` gives you an extended version of the regular `Request` object that has the following
properties:

- `request.params`: An object that contains the parameters that are given in the url pattern.
- `request.query`: An object that contains the query parameters that are given in the url.

You can learn more about the original `Request` object
[here](https://developer.mozilla.org/en-US/docs/Web/API/Request).

### Basic Routing

```ts
// Then use it in any environment
import { createServer } from 'http'
import { createRouter, Response, Router } from '@whatwg-node/router'

const router = createRouter()
  // GET collection index
  .route({
    method: 'GET',
    path: '/todos',
    handler: () => new Response('Todos Index!')
  })
  // GET item
  .route({
    method: 'GET',
    path: '/todos/:id',
    handler: ({ params }) => new Response(`Todo #${params.id}`)
  })
  // POST to the collection (we'll use async here)
  .route({
    method: 'POST',
    path: '/todos',
    handler: async request => {
      const content = await request.json()
      return new Response('Creating Todo: ' + JSON.stringify(content))
    }
  })

  // Redirect to a URL
  .route({
    method: 'GET',
    path: '/google',
    handler: () => Response.redirect('http://www.google.com')
  })

  // 404 for everything else
  .route({
    path: '*',
    handler: () => new Response('Not Found.', { status: 404 })
  })

const httpServer = createServer(router)
httpServer.listen(4000)
```

## Example

Let's create a basic REST API that manages users.

```ts
import { createRouter, Response } from '@whatwg-node/router'

const users = [
  { id: '1', name: 'John' },
  { id: '2', name: 'Jane' }
]

const router = createRouter()
  .route({
    method: 'GET',
    path: '/users',
    handler: () => Response.json(users)
  })
  // Parameters are given in the `request.params` object
  .route({
    method: 'GET',
    path: '/users/:id',
    handler: request => {
      const user = users.find(user => user.id === request.params.id)

      if (!user) {
        return new Response(null, {
          status: 404
        })
      }

      return Response.json(user)
    }
  })
  .route({
    method: 'DELETE',
    path: '/users/:id',
    handler: request => {
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
    }
  })
  // Handle JSON bodies
  .route({
    method: 'PUT',
    path: '/users',
    handler: async request => {
      const body = await request.json()

      const user = {
        id: String(users.length + 1),
        name: body.name
      }

      users.push(user)

      return Response.json(user)
    }
  })
  // Handle both parameters and JSON body
  .route({
    method: 'PATCH',
    path: '/users/:id',
    handler: async request => {
      const user = users.find(user => user.id === request.params.id)

      if (!user) {
        return new Response(null, {
          status: 404
        })
      }

      const body = await request.json()

      user.name = body.name

      return Response.json(user)
    }
  })
```

## Middlewares

You can also use middlewares to handle requests. Middlewares are functions that are called before
the request is handled by the router. You can use them to handle authentication, logging, etc.

If a handler function doesn't return a `Response` object, the request will be passed to the next
handler.

```ts
// In the following example, we are checking if the request has an `Authorization` header.
const router = createRouter()
  .route({
    path: '*',
    handler: request => {
      if (!request.headers.get('Authorization')) {
        return new Response(null, {
          status: 401
        })
      }
    }
  })
  .route({
    path: '/users',
    method: 'GET',
    handler: request => {
    // It doesn't reach here if the request doesn't have an `Authorization` header.
  });
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

const router = createRouter().route({
  path: '/users',
  method: 'GET',
  handler: [
    withAuth,
    request => {
      // It doesn't reach here if the request doesn't have an `Authorization` header.
    }
  ]
})
```

## Error handling

If an unexpected error is thrown, the response will have a `500` status code. You can use the
`try/catch` method to handle errors. Or you can use the plugins to handle errors like below.

```ts
const router = createRouter().route({
  path: '/users',
  method: 'GET',
  handler: request => {
    try {
      // Do something
    } catch (error) {
      return new Response('I handled the error gracefully', {
        status: 500
      })
    }
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

You can use `useCookies` to parse cookies from the request header and set cookies in the response by
using Web Standard [CookieStore](https://developer.mozilla.org/en-US/docs/Web/API/CookieStore).

```ts
import { createRouter, Response, useCookies } from '@whatwg-node/router'

const router = createRouter({
  plugins: [useCookies()]
})
.route({
  path: '/users',
  method: 'GET',
  handler: request => {
    const sessionId = await request.cookieStore.get('session_id')
    if (!sessionId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await getUserBySessionId(sessionId)
    return Response.json(user)
  }
})
.route({
  path: '/login',
  method: 'POST',
  handler: async request => {
    const { username, password } = await request.json()
    const sessionId = await createSessionForUser({ username, password })
    await request.cookieStore.set('session_id', sessionId)
    return Response.json({ message: 'ok' })
  }
})
```

### CORS Management

You can also setup a CORS middleware to handle preflight CORS requests.

```ts
import { createRouter, useCORS } from '@whatwg-node/router'

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
  plugins: [useRequestId()]
})
```

## End-to-End Type Safety and Validation with JSON Schema

Even if the library provides you some type safety with TypeScript's type inference, you can still
use JSON Schemas to have a better type safety on both request and response.

To define type-safe routes, we use `schemas` parameters

### Typing the request

You can type individual parts of the `Request` object including JSON body, headers, query
parameters, and URL parameters.

#### JSON Body

```ts
import { createRouter, Response } from '@whatwg-node/router'

const router = createRouter().route(
  {
    method: 'post',
    path: '/todos',
    // Define the request body schema
    schemas: {
      request: {
        json: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            completed: { type: 'boolean' }
          },
          additionalProperties: false,
          required: ['title']
        }
      }
    }
  },
  async request => {
    // This part is fully typed
    const { title, completed } = await request.json()
    // ...
    return Response.json({ message: 'ok' })
  }
)
```

#### Headers

```ts
import { createRouter, Response } from '@whatwg-node/router'

const router = createRouter().route(
  {
    method: 'post',
    path: '/todos',
    // Define the request body schema
    schemas: {
      request: {
        headers: {
          type: 'object',
          properties: {
            'x-api-key': { type: 'string' }
          },
          additionalProperties: false,
          required: ['x-api-key']
        }
      }
    }
  },
  async request => {
    // This part is fully typed
    const apiKey = request.headers.get('x-api-key')
    // Would fail on TypeScript compilation
    const wrongHeaderName = request.headers.get('x-api-key-wrong')
    // ...
    return Response.json({ message: 'ok' })
  }
)
```

#### Path Parameters

```ts
import { createRouter, Response } from '@whatwg-node/router'

const router = createRouter().route(
  {
    method: 'get',
    path: '/todos/:id',
    // Define the request body schema
    schemas: {
      request: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          additionalProperties: false,
          required: ['id']
        }
      }
    }
  },
  async request => {
    // This part is fully typed
    const { id } = request.params
    // ...
    return Response.json({ message: 'ok' })
  }
)
```

#### Query Parameters

```ts
import { createRouter, Response } from '@whatwg-node/router'

const router = createRouter().addRoute({
  method: 'get',
  path: '/todos',
  // Define the request body schema
  schemas: {
    request: {
      query: {
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

### Typing the response

You can also type the response body by the status code. We strongly recommend to explicitly define
the status codes.

```ts
import { createRouter, Response } from '@whatwg-node/router'

const router = createRouter().addRoute(
  {
    method: 'get',
    path: '/todos',
    // Define the request body schema
    schemas: {
      request: {
        headers: {
          type: 'object',
          properties: {
            'x-api-key': { type: 'string' }
          },
          additionalProperties: false,
          required: ['x-api-key']
        }
      },
      response: {
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
  },
  async request => {
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey) {
      return Response.json(
        { message: 'API key is required' },
        {
          status: 401
        }
      )
    }
    const todos = await getTodos({
      apiKey
    })
    // This part is fully typed
    return Response.json(todos, {
      status: 200
    })
  }
)
```

### Runtime validation with Ajv

The library itself doesn't include a runtime validation by default. But you can use that plugin to
have a runtime validation with the provided JSON Schemas above. This plugin uses
[Ajv](https://ajv.js.org/) under the hood. All you have to do is to install
`@whatwg-node/router-plugin-ajv` package and add it to the plugins.

```ts
import { createRouter } from '@whatwg-node/router'
import { useAjv } from '@whatwg-node/router-plugin-ajv'

const router = createRouter({
  plugins: [useAjv()]
})
```

### OpenAPI Generation

You can generate OpenAPI specification from the defined routes by using OpenAPI plugin. This plugin
also provides you a [Swagger UI](https://swagger.io/tools/swagger-ui/) to test the API.

```ts
import { createRouter, useOpenAPI } from '@whatwg-node/router'

const router = createRouter({
  plugins: [
    useOpenAPI({
      baseOas: {
        openapi: '3.0.1',
        info: {
          title: 'Todo List Example',
          description: 'A simple todo list example with @whatwg-node/router',
          version: '1.0.0'
        },
        components: {}
      }
    })
  ]
})
```

### Using a programmatic JSON Schema builder (`zod`-like API)

```ts
import { Static, Type } from '@sinclair/typebox'

const Todo = Type.Object({
  id: Type.String(),
  title: Type.String(),
  completed: Type.Boolean()
})

type Todo = Static<typeof Todo>

const router = createRouter().route({
  path: '/todos',
  schemas: {
    request: {
      body: Todo
    },
    response: {
      200: Type.Array(Todo)
    }
  }
})
```

### Type-safety on the client side

With this library, you can also type the request and response on the client side. But you have two
options;

1. You can infer the types from the router itself by using `createRouterSDK` from this library.
2. You can use OpenAPI client package that infers the types from the given OpenAPI document.

#### Using `createRouterSDK`

```ts file=examples/client.ts
import { createRouterSDK } from '@whatwg-node/router'
import type { router } from '../router'

const sdk = createRouterSDK<typeof router>({
  endpoint: 'http://localhost:3000'
})
```

## Usage in environments

`Router` is actually an instance of `ServerAdapter` of `@whatwg-node/server` package. So you can use
it in any environment just like `ServerAdapter`. See the [documentation](../server/README.md) of
`@whatwg-node/server` package for more information.
