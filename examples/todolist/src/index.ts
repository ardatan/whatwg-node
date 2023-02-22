import { crypto } from '@whatwg-node/fetch';
import { FromSchema, Response, createRouter, useOpenAPI } from '@whatwg-node/router';
import { createServer } from 'http';

const router = createRouter({
    plugins: [
        useOpenAPI(),
    ]
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
    method: 'get',
    path: '/todos',
    schemas: {
        Responses: {
            200: {
                type: 'array',
                items: TodoSchema,
            },
        }
    } as const,
    handler: () => Response.json(todos, {
        status: 200,
    }),
});

router.addRoute({
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
        }
        todos.push(todo);
        return Response.json(todo, {
            status: 200,
        });
    }
});

router.addRoute({
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
            return Response.json({ error: 'not found' }, {
                status: 404,
            });
        }
        const todo = todos[index];
        todos.splice(index, 1);
        return Response.json({
            id: todo.id,
        }, {
            status: 200,
        });
    }
});

createServer(router).listen(3000, () => {
    console.log('See docs on http://localhost:3000/docs');
});