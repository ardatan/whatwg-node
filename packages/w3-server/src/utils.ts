import { IncomingMessage, ServerResponse } from 'http';
import { Headers, ReadableStream, Request } from 'cross-undici-fetch';
import { Readable } from 'stream'

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

export async function sendToServerResponse(responseResult: Response, serverResponse: ServerResponse) {
  responseResult.headers.forEach((value, name) => {
    serverResponse.setHeader(name, value)
  })
  serverResponse.statusCode = responseResult.status
  serverResponse.statusMessage = responseResult.statusText
  // Some fetch implementations like `node-fetch`, return `Response.body` as Promise
  const responseBody = await (responseResult.body as unknown as Promise<any>)
  const nodeReadable = Readable.from(responseBody)
  nodeReadable.pipe(serverResponse)
}
