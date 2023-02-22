import { OpenAPIV3_1 } from 'openapi-types';
import { Response } from './createRouter';
import swaggerUiHtml from './swagger-ui-html';
import { RouterPlugin } from './types';

export type OpenAPIPluginOptions = {
  oasPath?: string;
  swaggerUIPath?: string;
  baseOas?: OpenAPIV3_1.Document;
};

export function useOpenAPI({
  oasPath = '/openapi.json',
  swaggerUIPath = '/docs',
  baseOas: oas = {
    openapi: '3.0.1',
    info: {
      title: 'My API',
      version: '1.0.0',
    },
    components: {},
  },
}: OpenAPIPluginOptions = {}): RouterPlugin<any> {
  const paths: OpenAPIV3_1.PathsObject = (oas.paths ||= {});
  return {
    onRouterInit(router) {
      router.get(oasPath, () => Response.json(oas));
      router.get(
        swaggerUIPath,
        () =>
          new Response(swaggerUiHtml.replace('__OAS_PATH__', JSON.stringify(oasPath)), {
            headers: {
              'Content-Type': 'text/html',
            },
            status: 200,
          }),
      );
    },
    onRoute({ method, path, operationId, description, schemas }) {
      if (schemas) {
        const pathObj = (paths[path] = paths[path] || {});
        pathObj[method] = (pathObj[method] || {}) as any;
        const operation = pathObj[method] as OpenAPIV3_1.OperationObject;
        operation.operationId = operationId;
        operation.description = description;
        if (schemas.Responses) {
          for (const statusCode in schemas.Responses) {
            const response = schemas.Responses[statusCode as any as number];
            operation.responses = operation.responses || {};
            operation.responses[statusCode] = {
              description: '',
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
