import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'node:http';
import {
  createServer as createHttp2Server,
  Http2ServerRequest,
  Http2ServerResponse,
} from 'node:http2';
import express, { Router } from 'express';
import { App } from 'uWebSockets.js';
import { createServerAdapter } from '../src/createServerAdapter.js';

const adapter = createServerAdapter(() => {
  return null as any;
});

const http2Req = null as unknown as Http2ServerRequest;
const http2Res = null as unknown as Http2ServerResponse;

adapter.handleNodeRequest(http2Req);
adapter.handleNodeRequestAndResponse(http2Req, http2Res);
adapter.handle(http2Req, http2Res);
adapter(http2Req, http2Res);
const http2Server = createHttp2Server(adapter);
http2Server.on('request', adapter);

const httpReq = null as unknown as IncomingMessage;
const httpRes = null as unknown as ServerResponse;

adapter.handleNodeRequest(httpReq);
adapter.handleNodeRequestAndResponse(httpReq, httpRes);
adapter.handle(httpReq, httpRes);
adapter(httpReq, httpRes);

const httpServer = createHttpServer(adapter);
httpServer.on('request', adapter);

App().any('/*', adapter);

const expressApp = express();
expressApp.use(adapter);

const expressRouter = Router();
expressRouter.use(adapter);
