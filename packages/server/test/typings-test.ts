import { createServer as createHttpServer, ServerResponse } from 'http';
import { createServer as createHttp2Server, Http2ServerRequest, Http2ServerResponse } from 'http2';
import { App } from 'uWebSockets.js';
import { NodeRequest } from '../src';
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

const httpReq = null as unknown as NodeRequest;
const httpRes = null as unknown as ServerResponse;

adapter.handleNodeRequest(httpReq);
adapter.handle(httpReq, httpRes);
adapter(httpReq, httpRes);

//  Types of parameters 'req' and 'req' are incompatible.
// Type 'IncomingMessage' is not assignable to type 'NodeRequest'.
// Types of property 'method' are incompatible.
//   Type 'string | undefined' is not assignable to type 'string'.
//     Type 'undefined' is not assignable to type 'string'.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const httpServer = createHttpServer(adapter);
httpServer.on('request', adapter);

App().any('/*', adapter);
