import { IncomingMessage, ServerResponse } from "http";
import { Headers, ReadableStream, Request } from "cross-undici-fetch";

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

export async function sendToServerResponse(
    response: Response,
    serverResponse: ServerResponse
) {
    const headersObj: any = {};
    response.headers.forEach((value, name) => {
        headersObj[name] = headersObj[name] || [];
        headersObj[name].push(value);
    });
    serverResponse.writeHead(response.status, headersObj);
    const responseBody: ReadableStream | null = response.body;
    if (responseBody == null) {
        throw new Error("Response body is not supported");
    }
    const reader = responseBody.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (value) {
            serverResponse.write(value);
        }
        if (done) {
            serverResponse.end();
            break;
        }
    }
    serverResponse.on("close", () => {
        reader.releaseLock();
    });
}