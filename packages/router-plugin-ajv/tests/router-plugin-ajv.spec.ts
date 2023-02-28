import Ajv from 'ajv';
import { createRouter, Response } from '@whatwg-node/router';
import { useAJV } from '@whatwg-node/router-plugin-ajv';

describe('Router AJV Plugin', () => {
  it('should return errors correctly', async () => {
    const router = createRouter({
      plugins: [
        useAJV({
          ajv: new Ajv(),
          request: {
            headers: true,
            params: true,
            query: true,
            json: true,
          },
        }),
      ],
    }).addRoute({
      path: '/test',
      method: 'POST',
      schemas: {
        request: {
          json: {
            type: 'object',
            properties: {
              foo: {
                type: 'string',
              },
              bar: {
                type: 'number',
              },
            },
            additionalProperties: false,
            required: ['foo', 'bar'],
          },
          headers: {
            type: 'object',
            properties: {
              authorization: {
                type: 'string',
                pattern: '^Bearer .+$',
              },
            },
            required: ['authorization'],
          },
          responses: {
            200: {
              type: 'object',
              properties: {
                baz: {
                  type: 'boolean',
                },
              },
            },
          },
        },
      } as const,
      handler() {
        return Response.json(
          {
            baz: true,
          },
          {
            status: 200,
          },
        );
      },
    });

    const response = await router.fetch('http://localhost:3000/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic 123',
      },
      body: JSON.stringify({
        foo: 123,
        bar: '123',
        baz: true,
      }),
    });

    const resultJson = await response.json();
    expect(resultJson).toMatchInlineSnapshot(`
      {
        "errors": [
          {
            "instancePath": "/authorization",
            "keyword": "pattern",
            "message": "must match pattern "^Bearer .+$"",
            "name": "headers",
            "params": {
              "pattern": "^Bearer .+$",
            },
            "schemaPath": "#/properties/authorization/pattern",
          },
          {
            "instancePath": "",
            "keyword": "additionalProperties",
            "message": "must NOT have additional properties",
            "name": "json",
            "params": {
              "additionalProperty": "baz",
            },
            "schemaPath": "#/additionalProperties",
          },
        ],
      }
    `);
    expect(response.status).toBe(400);
  });
});
