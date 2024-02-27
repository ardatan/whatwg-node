import { Server, STATUS_CODES } from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import { fetch, Response } from '@whatwg-node/fetch';
import { createServerAdapter } from '../src/createServerAdapter.js';
import { runTestsForEachFetchImpl } from './test-fetch.js';

describe('express', () => {
  let server: Server;
  let port: number;
  beforeAll(async () => {
    const app = express();
    app.use(
      '/my-path',
      createServerAdapter(async req => {
        const data = await req.json();
        return new Response(null, {
          status: data.status || 200,
          headers: data.headers || {
            'x-foo': 'foo',
            'x-bar': 'bar',
          },
        });
      }),
    );
    server = app.listen(0);
    await new Promise<void>(resolve => server.once('listening', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(() => {
    return new Promise<void>(resolve => {
      server.close(() => resolve());
    });
  });

  runTestsForEachFetchImpl(() => {
    describe('should respond with relevant status code', () => {
      for (const statusCodeStr in STATUS_CODES) {
        const status = Number(statusCodeStr);
        if (status < 200) continue;
        it(`should respond with ${statusCodeStr}`, async () => {
          const res = await fetch(`http://localhost:${port}/my-path`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({ status }),
          });
          expect(res.status).toBe(status);
          expect(res.statusText).toBe(STATUS_CODES[status]);
          await res.text();
        });
      }
    });

    it('should handle headers correctly', async () => {
      const res = await fetch(`http://localhost:${port}/my-path`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ headers: { 'x-foo': 'foo', 'x-bar': 'bar' } }),
      });
      expect(res.headers.get('x-foo')).toBe('foo');
      expect(res.headers.get('x-bar')).toBe('bar');
      await res.text();
    });
  });
});
