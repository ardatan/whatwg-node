import { IncomingMessage, ServerResponse } from 'http';
import { Headers, ReadableStream, Request } from 'cross-undici-fetch';
import { inspect } from 'util';

export function createRequestFromIncomingMessage(incomingMessage: IncomingMessage) {
  const headers = new Headers();
  for (const headerName in incomingMessage.headers) {
    const reqHeaderValue = incomingMessage.headers[headerName];
    if (Array.isArray(reqHeaderValue)) {
      for (const singleValue of reqHeaderValue) {
        headers.append(headerName, singleValue);
      }
    } else if (reqHeaderValue != null) {
      headers.append(headerName, reqHeaderValue);
    }
  }
  const requestInit: RequestInit = {
    credentials: 'include',
    headers,
    method: incomingMessage.method,
  };
  if (incomingMessage.method !== 'GET' && incomingMessage.method !== 'HEAD') {
    requestInit.body = new ReadableStream({
      async start(controller) {
        for await (const chunk of incomingMessage) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });
  }
  const fullUrl = `http://${incomingMessage.headers.host}${incomingMessage.url}`;
  return new Request(fullUrl, requestInit);
}

export async function sendToServerResponse(response: Response, serverResponse: ServerResponse) {
  response.headers.forEach((value, name) => {
    serverResponse.setHeader(name, value);
  });
  serverResponse.statusCode = response.status;
  serverResponse.statusMessage = response.statusText;
  const responseBody = response.body;
  if (responseBody != null) {
    if (responseBody instanceof Uint8Array) {
      serverResponse.write(responseBody);
    } else if (Symbol.asyncIterator in responseBody) {
      for await (const chunk of responseBody as any) {
        if (chunk) {
          serverResponse.write(chunk);
        }
      }
    } else if (typeof responseBody.getReader === 'function') {
      const reader = responseBody.getReader();
      serverResponse.on('close', () => {
        reader.releaseLock();
      });
      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          serverResponse.write(value);
        }
        if (done) {
          break;
        }
      }
    } else {
      serverResponse.statusCode = 500;
      serverResponse.statusMessage = 'Internal Server Error';
      serverResponse.writeHead(500, 'Internal Server Error', {
        'Content-Type': 'text/plain',
      });
      serverResponse.write(`Unsupported response body type: ${inspect(responseBody)}`);
    }
  }
  serverResponse.end();
}
