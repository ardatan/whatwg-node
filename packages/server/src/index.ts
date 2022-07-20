import type { RequestListener, ServerResponse } from 'http';
import { NodeRequest, normalizeNodeRequest, sendNodeResponse } from './utils';
import { Request as PonyfillRequestCtor } from '@whatwg-node/fetch';

interface CreateServerAdapterOptions<TServerContext> {
  Request?: typeof Request;
  handleRequest: (request: Request, serverContext: TServerContext) => Promise<Response>;
}

interface ServerAdapter<TServerContext> {
  requestListener: RequestListener;
  handleNodeRequest(nodeRequest: NodeRequest, serverContext: TServerContext): Promise<Response>;
}

export function createServerAdapter<TServerContext = {
  req: NodeRequest,
  res: ServerResponse,
}>({
  Request: RequestCtor = PonyfillRequestCtor,
  handleRequest,
}: CreateServerAdapterOptions<TServerContext>): ServerAdapter<TServerContext> {
  function handleNodeRequest(nodeRequest: NodeRequest, serverContext: TServerContext): Promise<Response> {
    const request = normalizeNodeRequest(nodeRequest, RequestCtor)
    return handleRequest(request, serverContext)
  }
  async function requestListener(nodeRequest: NodeRequest, serverResponse: ServerResponse) {
    const response = await handleNodeRequest(nodeRequest, { req: nodeRequest, res: serverResponse } as any)
    return sendNodeResponse(response, serverResponse);
  }
  return {
    handleNodeRequest,
    requestListener,
  }
}
