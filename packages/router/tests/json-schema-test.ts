import { FromSchema } from 'json-schema-to-ts';
import { createRouter, Response } from '../src';

const router = createRouter();

const successfulResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
  },
  additionalProperties: false,
} as const;

const unauthorizedResponseSchema = {
  type: 'object',
  properties: {
    code: { type: 'string' },
  },
  additionalProperties: false,
} as const;

const notFoundResponseSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
  },
  additionalProperties: false,
} as const;

const headersSchema = {
  type: 'object',
  properties: {
    'x-token': { type: 'string' },
  },
  required: ['x-token'],
  additionalProperties: false,
} as const;

const pathParamsSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
  },
  additionalProperties: false,
} as const;

router.get<{
  Request: {
    PathParams: FromSchema<typeof pathParamsSchema>;
    Headers: FromSchema<typeof headersSchema>;
  };
  Responses: {
    200: FromSchema<typeof successfulResponseSchema>;
    401: FromSchema<typeof unauthorizedResponseSchema>;
    404: FromSchema<typeof notFoundResponseSchema>;
  };
}>('/users/:id', async req => {
  const token = req.headers.get('x-token');
  if (!token) {
    return Response.json(
      {
        code: 'UNAUTHORIZED',
      },
      {
        status: 401,
      },
    );
  }
  const userId = req.params.id;
  // @ts-expect-error - a is not defined in the schema
  const unexpectedParam = req.params.a;
  console.log(unexpectedParam);
  if (userId === 'only_available_id') {
    return Response.json(
      {
        id: userId,
        name: 'The only one',
      },
      {
        status: 200,
      },
    );
  }
  return Response.json(
    {
      message: 'Not found',
    },
    {
      status: 404,
    },
  );
});

const routerWithAddRoute = createRouter()
  .addRoute({
    method: 'get',
    path: '/users/:id',
    schemas: {
      Request: {
        PathParams: pathParamsSchema,
        Headers: headersSchema,
      },
      Responses: {
        200: successfulResponseSchema,
        401: unauthorizedResponseSchema,
        404: notFoundResponseSchema,
      },
    },
    handler: async req => {
      const token = req.headers.get('x-token');
      if (!token) {
        return Response.json(
          {
            code: 'UNAUTHORIZED',
          },
          {
            status: 401,
          },
        );
      }
      const userId = req.params.id;
      // @ts-expect-error - a is not defined in the schema
      const unexpectedParam = req.params.a;
      console.log(unexpectedParam);
      if (userId === 'only_available_id') {
        return Response.json(
          {
            id: userId,
            name: 'The only one',
          },
          {
            status: 200,
          },
        );
      }
      return Response.json(
        {
          message: 'Not found',
        },
        {
          status: 404,
        },
      );
    },
  })
  .addRoute({
    method: 'get',
    path: '/users',
    schemas: {
      Request: {
        Headers: headersSchema,
      },
      Responses: {
        200: {
          type: 'array',
          items: successfulResponseSchema,
        },
        401: unauthorizedResponseSchema,
      },
    },
    handler: async req => {
      const token = req.headers.get('x-token');
      if (!token) {
        return Response.json(
          {
            code: 'UNAUTHORIZED',
          },
          {
            status: 401,
          },
        );
      }
      return Response.json(
        [
          {
            id: 'only_available_id',
            name: 'The only one',
          },
        ],
        { status: 200 },
      );
    },
  })
  .addRoute({
    method: 'get',
    path: '/health',
    handler: async () => {
      if (!globalThis['db']) {
        return Response.json(
          {
            error: 'DB is not available',
          },
          {
            status: 500,
          },
        );
      }
      return Response.json(
        {
          message: 'OK',
        },
        {
          status: 200,
        },
      );
    },
  });

const res = await routerWithAddRoute.__sdk['/health'].get();

// @ts-expect-error - 300 is not a valid status code
res.status = 300;

if (res.status === 200) {
  const jsonBody = await res.json();
  const message = jsonBody.message;
  // @ts-expect-error - error is not defined in the schema
  console.log(jsonBody.error);
  console.log(message);
}

if (res.status === 500) {
  const jsonBody = await res.json();
  // @ts-expect-error - message is not defined in the schema
  console.log(jsonBody.message);
  const error = jsonBody.error;
  console.log(error);
}
