import { AddressInfo } from 'net';
import express from 'express'
import { fetch, Response } from '@whatwg-node/fetch';
import { createServerAdapter } from '../src/createServerAdapter.js';
import { STATUS_CODES, Server } from 'http'

describe('express', () => {
  let server: Server;
  let port: number;
  beforeAll(async () => {
    const app = express()
    app.use('/my-path', createServerAdapter(async (req, ctx) => {
      const data = await req.json();
      return new Response(null, { status: data.status });
    }))
    server = app.listen(0);
    await new Promise<void>((resolve) => server.on('listening', resolve));
    port = (server.address() as AddressInfo).port;
  })

  afterAll(() => {
    return new Promise<void>(resolve => {
      server.close(() => resolve())
      server.closeAllConnections()
    })
  })

  it('should respond with relevant status code', async () => {
    for (const statusCodeStr in STATUS_CODES) {
      const status = Number(statusCodeStr)
      if (status < 200) continue;
      const res = await fetch(`http://localhost:${port}/my-path`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ status }),
      })
      expect(res.status).toBe(status)
      expect(res.statusText).toBe(STATUS_CODES[status])
    }
  });
});
