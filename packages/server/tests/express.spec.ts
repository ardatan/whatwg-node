import { Server, STATUS_CODES } from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import { runTestsForEachFetchImpl } from './test-fetch.js';

describe('express', () => {
  runTestsForEachFetchImpl((_, { createServerAdapter, fetchAPI: { fetch, Response } }) => {
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

    describe('should respond with relevant status code', () => {
      for (const statusCodeStr in STATUS_CODES) {
        const status = Number(statusCodeStr);
        if (status < 200) {
          // Informational responses are not supported by fetch in this way
          continue;
        }
        if (status === 421) {
          // 421 Misdirected Request is not supported by fetch in this way
          continue;
        }
        if (status === 407) {
          // 407 Proxy Authentication Required is not supported by fetch in this way
          continue;
        }
        if (status === 509) {
          // 509 Bandwidth Limit Exceeded is not supported by fetch in this way
          continue;
        }
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
