import { promises as fsPromises } from 'fs';
import { createServer } from 'http';
import { join } from 'path';
import { createRouter, FromSchema, Response, useOpenAPI } from '@whatwg-node/router';

const router = createRouter({
  plugins: [
    useOpenAPI({
      baseOas: {
        openapi: '3.0.1',
        info: {
          title: 'Todo List Example',
          description: 'A simple todo list example with @whatwg-node/router',
          version: '1.0.0',
        },
        components: {},
      },
    }),
  ],
});

const TodoSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    content: { type: 'string' },
  },
  required: ['id', 'content'],
  additionalProperties: false,
} as const;

type Todo = FromSchema<typeof TodoSchema>;

const todos: Todo[] = [];

router.addRoute({
  operationId: 'getTodos',
  description: 'Get all todos',
  method: 'get',
  path: '/todos',
  schemas: {
    Responses: {
      200: {
        type: 'array',
        items: TodoSchema,
      },
    },
  } as const,
  handler: () =>
    Response.json(todos, {
      status: 200,
    }),
});

router.addRoute({
  operationId: 'addTodo',
  description: 'Add a todo',
  method: 'put',
  path: '/todo',
  schemas: {
    Request: {
      JSONBody: {
        type: 'object',
        properties: {
          content: { type: 'string' },
        },
        required: ['content'],
        additionalProperties: false,
      },
    },
    Responses: {
      200: TodoSchema,
    },
  } as const,
  handler: async request => {
    const input = await request.json();
    const todo: Todo = {
      id: crypto.randomUUID(),
      content: input.content,
    };
    todos.push(todo);
    return Response.json(todo, {
      status: 200,
    });
  },
});

router.addRoute({
  operationId: 'deleteTodo',
  description: 'Delete a todo',
  method: 'delete',
  path: '/todo/:id',
  schemas: {
    Request: {
      PathParams: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        additionalProperties: false,
        required: ['id'],
      },
    },
    Responses: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
        additionalProperties: false,
      },
      404: {
        type: 'object',
        properties: {
          error: { type: 'string' },
        },
        required: ['error'],
        additionalProperties: false,
      },
    },
  } as const,
  handler: async request => {
    const { id } = request.params;
    const index = todos.findIndex(todo => todo.id === id);
    if (index === -1) {
      return Response.json(
        { error: 'not found' },
        {
          status: 404,
        },
      );
    }
    const todo = todos[index];
    todos.splice(index, 1);
    return Response.json(
      {
        id: todo.id,
      },
      {
        status: 200,
      },
    );
  },
});

const savedOpenAPIFilePath = join(__dirname, 'saved_openapi.ts');
// Write the OpenAPI spec to a file
Promise.resolve(router.fetch('http://localhost:3000/openapi.json'))
  .then(openapiRes => openapiRes.text())
  .then(openapiText =>
    fsPromises.writeFile(
      savedOpenAPIFilePath,
      `/* eslint-disable */
export default ${openapiText} as const;`,
    ),
  )
  .then(() => console.log(`OpenAPI schema is written to ${savedOpenAPIFilePath}`))
  .catch(err => {
    console.error(`Could not write OpenAPI schema to file: ${err.message}`);
    process.exit(1);
  });

createServer(router).listen(3000, () => {
  console.log('SwaggerUI is served at http://localhost:3000/docs');
});
