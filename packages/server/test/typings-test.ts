import { Http2ServerRequest, Http2ServerResponse } from 'http2';
import { createServerAdapter } from '../src/createServerAdapter';

const adapter = createServerAdapter(() => {
  return null as any;
});

const req = null as unknown as Http2ServerRequest;
const res = null as unknown as Http2ServerResponse;

adapter.handleNodeRequest(req);
adapter.handle(req, res);
adapter(req, res);
