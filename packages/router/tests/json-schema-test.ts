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

router.addRoute({
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
  }
})