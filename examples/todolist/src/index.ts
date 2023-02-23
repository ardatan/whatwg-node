import { createServer } from 'http';
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

createServer(router).listen(3000, () => {
  console.log('See docs on http://localhost:3000/docs');
});
