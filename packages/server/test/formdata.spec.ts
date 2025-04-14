import http from 'node:http';
import NodeFormData from 'form-data';
import { describe, expect, it } from '@jest/globals';
import { createServerAdapter } from '../src/createServerAdapter';
import { runTestsForEachFetchImpl } from './test-fetch.js';
import { runTestsForEachServerImpl } from './test-server.js';

describe('FormData', () => {
  runTestsForEachServerImpl(testServer => {
    runTestsForEachFetchImpl(
      (_, { createServerAdapter, fetchAPI: { Response, FormData, File, fetch } }) => {
        if (!File) {
          it.skip('File does not exist in this version of Node', () => {});
          return;
        }
        it('should forward formdata correctly', async () => {
          let receivedFieldContent: string | undefined;
          let receivedFileName: string | undefined;
          let receivedFileType: string | undefined;
          let receivedFileContent: string | undefined;
          const adapter = createServerAdapter(async request => {
            try {
              const body = await request.formData();
              receivedFieldContent = body.get('foo') as string;
              const file = body.get('baz') as File;
              receivedFileName = file.name;
              receivedFileType = file.type;
              receivedFileContent = await file.text();
            } catch (e: any) {
              return new Response(e.stack, {
                status: 500,
              });
            }
            return new Response(null, {
              status: 204,
            });
          });
          await testServer.addOnceHandler(adapter);
          const formData = new FormData();
          formData.append('foo', 'bar');
          formData.append('baz', new File(['baz'], 'baz.txt', { type: 'text/plain' }));
          const response = await fetch(testServer.url, {
            method: 'POST',
            body: formData,
          });
          expect(await response.text()).toBe('');
          expect(response.status).toBe(204);
          expect(receivedFieldContent).toBe('bar');
          expect(receivedFileName).toBe('baz.txt');
          expect(receivedFileType).toContain('text/plain');
          expect(receivedFileContent).toBe('baz');
        });
      },
    );

    it('should parse form data where content-lenght is smaller than the actual data', async () => {
      const adapter = createServerAdapter(async request => {
        // this will throw and the server will automatically respond with a 400
        // TODO: why? the user should have control over the response
        await request.formData();
        return new Response();
      });
      await testServer.addOnceHandler(adapter);

      const formData = new NodeFormData();
      formData.append('foo', Buffer.alloc(1000), {
        filename: 'foo.txt',
        filepath: '/tmp/foo.txt',
        contentType: 'text/plain',
      });

      const url = new URL(testServer.url);

      const req = http.request({
        method: 'post',
        hostname: url.hostname,
        port: url.port,
        headers: {
          ...formData.getHeaders(),
          'content-length': 10,
        },
      });

      formData.pipe(req);

      const res: http.IncomingMessage = await new Promise((resolve, reject) => {
        req.on('error', err => {
          reject(err);
        });
        req.on('response', res => {
          resolve(res);
        });
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
