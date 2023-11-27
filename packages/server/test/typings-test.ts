import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'http';
import { createServer as createHttp2Server, Http2ServerRequest, Http2ServerResponse } from 'http2';
import { App } from 'uWebSockets.js';
import { createServerAdapter } from '../src/createServerAdapter.js';

const adapter = createServerAdapter(() => {
  return null as any;
});

const http2Req = null as unknown as Http2ServerRequest;
const http2Res = null as unknown as Http2ServerResponse;

adapter.handleNodeRequest(http2Req);
adapter.handle(http2Req, http2Res);
adapter(http2Req, http2Res);
const http2Server = createHttp2Server(adapter);
http2Server.on('request', adapter);

const httpReq = null as unknown as IncomingMessage;
const httpRes = null as unknown as ServerResponse;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Argument of type 'IncomingMessage' is not assignable to parameter of type 'NodeRequest'.
// Types of property 'method' are incompatible.
// Type 'string | undefined' is not assignable to type 'string'.
//   Type 'undefined' is not assignable to type 'string'.ts(2345)
adapter.handleNodeRequest(httpReq);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Argument of type 'IncomingMessage' is not assignable to parameter of type '{ request: Request; } & Partial<{}>'.
// Property 'request' is missing in type 'IncomingMessage' but required in type '{ request: Request; }'.
adapter.handle(httpReq, httpRes);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Argument of type 'IncomingMessage' is not assignable to parameter of type '{ request: Request; } & Partial<{}>'.
adapter(httpReq, httpRes);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Types of parameters 'req' and 'req' are incompatible.
// Type 'IncomingMessage' is not assignable to type 'NodeRequest'.
const httpServer = createHttpServer(adapter);
httpServer.on('request', adapter);

App().any('/*', adapter);
