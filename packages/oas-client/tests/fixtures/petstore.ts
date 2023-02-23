export const petstoreOas = {
  openapi: '3.0.1',
  info: {
    title: 'Todo List Example',
    description: 'A simple todo list example with @whatwg-node/router',
    version: '1.0.0',
  },
  components: {},
  paths: {
    '/todos': {
      get: {
        operationId: 'getTodos',
        description: 'Get all todos',
        responses: {
          200: {
            description: '',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { id: { type: 'string' }, content: { type: 'string' } },
                    required: ['id', 'content'],
                    additionalProperties: false,
                  },
                },
              },
            },
          },
        },
      },
    },
    '/todo': {
      put: {
        operationId: 'addTodo',
        description: 'Add a todo',
        responses: {
          200: {
            description: '',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { id: { type: 'string' }, content: { type: 'string' } },
                  required: ['id', 'content'],
                  additionalProperties: false,
                },
              },
            },
          },
        },
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { content: { type: 'string' } },
                required: ['content'],
                additionalProperties: false,
              },
            },
          },
        },
      },
    },
    '/todo/{id}': {
      get: {
        operationId: 'getTodo',
        description: 'Get a todo',
        responses: {
          200: {
            description: '',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { id: { type: 'string' }, content: { type: 'string' } },
                  required: ['id', 'content'],
                  additionalProperties: false,
                },
              },
            },
          },
          404: {
            description: 'Not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { message: { type: 'string' } },
                  required: ['message'],
                  additionalProperties: false,
                },
              },
            },
          },
        },
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
          },
          {
            name: 'Authorization',
            in: 'header',
            required: true,
            schema: {
              type: 'string',
            },
          },
        ],
      },
    },
  },
} as const;
