import { Buffer } from 'node:buffer';
import { pipeline } from 'node:stream/promises';
import type { Context, LambdaFunctionURLEvent } from 'aws-lambda';
import { createTestServerAdapter } from '@e2e/shared-server';

const app = createTestServerAdapter<ServerContext>();

interface ServerContext {
  event: LambdaFunctionURLEvent;
  lambdaContext: Context;
  res: awslambda.HttpResponseStream;
}

export const handler = awslambda.streamifyResponse(async function handler(
  event: LambdaFunctionURLEvent,
  res,
  lambdaContext,
) {
  const response = await app.fetch(
    // Construct the URL
    `https://${event.requestContext.domainName}${event.requestContext.http.path}?${event.rawQueryString}`,
    {
      method: event.requestContext.http.method,
      headers: event.headers as HeadersInit,
      // Parse the body if needed
      body:
        event.body && event.isBase64Encoded
          ? Buffer.from(event.body, 'base64')
          : event.body || null,
    },
    {
      event,
      res,
      lambdaContext,
    },
  );

  // Attach the metadata to the response stream
  res = awslambda.HttpResponseStream.from(res, {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers.entries()),
  });

  if (response.body) {
    // @ts-expect-error - Pipe the response body to the response stream
    await pipeline(response.body, res);
  }

  // End the response stream
  res.end();
});
