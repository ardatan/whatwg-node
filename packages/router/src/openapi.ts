import { OpenAPIV3_1 } from 'openapi-types';
import { Response } from './createRouter';
import { RouterPlugin } from './types';

export type OpenAPIPluginOptions = {
    schemaPath?: string;
    swaggerUIPath?: string;
};

export function useOpenAPI({
    schemaPath = '/openapi.json',
    swaggerUIPath = '/docs',
}: OpenAPIPluginOptions = {}): RouterPlugin<any> {
    const paths: OpenAPIV3_1.PathsObject = {};
    const openAPI: OpenAPIV3_1.Document = {
        openapi: '3.0.1',
        info: {
            title: 'My API',
            version: '1.0.0',
        },
        paths,
        components: {},
    };
    return {
        onRouterInit(router) {
            router.get(schemaPath, () => Response.json(openAPI));
            router.get(
                swaggerUIPath,
                () =>
                    new Response(`
                  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta
      name="description"
      content="SwaggerUI"
    />
    <title>SwaggerUI</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
  </head>
  <body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        spec: ${JSON.stringify(openAPI)},
        dom_id: '#swagger-ui',
      });
    };
  </script>
  </body>
  </html>
            `, {
                        headers: {
                            'Content-Type': 'text/html',
                        },
                        status: 200,
                    }),
            );
        },
        onRoute({ method, path, schemas }) {
            if (schemas) {
                const pathObj = (paths[path] = paths[path] || {});
                pathObj[method] = (pathObj[method] || {}) as any;
                const operation = pathObj[method] as OpenAPIV3_1.OperationObject;
                operation.operationId = `Random operation ID for now: ${Date.now()}`;
                if (schemas.Responses) {
                    for (const statusCode in schemas.Responses) {
                        const response = schemas.Responses[statusCode as any as number];
                        operation.responses = operation.responses || {};
                        operation.responses[statusCode] = {
                            description: 'No description for now',
                            content: {
                                'application/json': {
                                    schema: response as any,
                                },
                            },
                        };
                    }
                }
                if (
                    schemas.Request?.Headers &&
                    typeof schemas.Request.Headers === 'object' &&
                    'properties' in schemas.Request.Headers
                ) {
                    for (const headerName in schemas.Request.Headers.properties) {
                        const headersSchema = schemas.Request.Headers.properties[headerName];
                        operation.parameters = operation.parameters || [];
                        operation.parameters.push({
                            name: headerName,
                            in: 'header',
                            required: schemas.Request.Headers.required?.includes(headerName),
                            schema: headersSchema as any,
                        });
                    }
                }
                if (
                    schemas.Request?.PathParams &&
                    typeof schemas.Request.PathParams === 'object' &&
                    'properties' in schemas.Request.PathParams
                ) {
                    for (const paramName in schemas.Request.PathParams.properties) {
                        const paramSchema = schemas.Request.PathParams.properties[paramName];
                        operation.parameters = operation.parameters || [];
                        operation.parameters.push({
                            name: paramName,
                            in: 'path',
                            required: schemas.Request.PathParams.required?.includes(paramName),
                            schema: paramSchema as any,
                        });
                    }
                }
                if (
                    schemas.Request?.QueryParams &&
                    typeof schemas.Request.QueryParams === 'object' &&
                    'properties' in schemas.Request.QueryParams
                ) {
                    for (const paramName in schemas.Request.QueryParams.properties) {
                        const paramSchema = schemas.Request.QueryParams.properties[paramName];
                        operation.parameters = operation.parameters || [];
                        operation.parameters.push({
                            name: paramName,
                            in: 'query',
                            required: schemas.Request.QueryParams.required?.includes(paramName),
                            schema: paramSchema as any,
                        });
                    }
                }
                if (schemas.Request?.JSONBody) {
                    operation.requestBody = {
                        content: {
                            'application/json': {
                                schema: schemas.Request.JSONBody as any,
                            },
                        },
                    };
                }
            }
        },
    };
}
