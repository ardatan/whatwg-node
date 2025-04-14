import { Buffer } from 'node:buffer';
import http from 'node:http';
import { setTimeout } from 'node:timers/promises';
import NodeFormData from 'form-data';
import { describe, expect, it } from '@jest/globals';
import { createDeferredPromise } from '@whatwg-node/promise-helpers';
import { runTestsForEachFetchImpl } from './test-fetch.js';
import { runTestsForEachServerImpl } from './test-server.js';

const skipIf = (condition: boolean) => (condition ? it.skip : it);

describe('FormData', () => {
  runTestsForEachServerImpl(testServer => {
    runTestsForEachFetchImpl(
      (
        _,
        {
          createServerAdapter,
          fetchAPI: { Response, FormData, File, fetch, ReadableStream, Request },
        },
      ) => {
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

        skipIf(!!globalThis.Deno)(
          'should fail parsing form data where content-lenght is smaller than the actual data',
          async () => {
            const adapter = createServerAdapter(async request => {
              try {
                await request.formData();
              } catch {
                // noop
              }
              // regardless of what you instruct node to reply with, node will always reply with a 400
              // if the content-length is smaller than the actual data
              return new Response(null, { status: 400 });
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
          },
        );

        skipIf(!!globalThis.Deno)(
          'should hang when parsing form data where content-lenght is larger than the actual data',
          async () => {
            const adapter = createServerAdapter(async request => {
              // the request's body stream will never end, because the content-length is larger than the actual data
              // this is expected and should be handled by the server itself in user-land
              // see https://github.com/nodejs/node/issues/17978
              //
              // TODO: form data promise should complete after response's been sent out
              request.formData();

              // wait some time, but the form data parsing should not resolve (at all)
              await setTimeout(100);

              return new Response(null, { status: 408 });
            });
            await testServer.addOnceHandler(adapter);

            const formData = new NodeFormData();
            formData.append('foo', Buffer.alloc(10), {
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
                'content-length': 1000,
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

            expect(res.statusCode).toBe(408);
          },
        );

        skipIf(!!globalThis.Deno)(
          'should fail parsing form data if the request gets cancelled',
          async () => {
            const {
              promise: waitForRequestHandling,
              resolve: requestHandled,
              reject: failRequestHandling,
            } = createDeferredPromise<FormData>();
            const adapter = createServerAdapter(async request => {
              try {
                const formData = await request.formData();
                requestHandled(formData);
              } catch (e) {
                failRequestHandling(e);
              }
              return new Response(null, { status: 500 });
            });
            await testServer.addOnceHandler(adapter);

            const req = new Request(testServer.url, {
              signal: AbortSignal.timeout(100),
              method: 'POST',
              headers: {
                'content-type': 'multipart/form-data; boundary="---"',
              },
              body: new ReadableStream({
                start(ctrl) {
                  ctrl.enqueue('---\n');
                  // never closes
                },
              }),
              // @ts-expect-error https://github.com/whatwg/fetch/pull/1457
              duplex: 'half',
            });

            const error = await fetch(req)
              .then(r => r.text())
              .catch(e => e);
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toMatch(/operation timed out|aborted/);

            const err = await waitForRequestHandling.catch(e => e);
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toMatch(/aborted|closed/);
          },
        );
      },
    );
  });
});
