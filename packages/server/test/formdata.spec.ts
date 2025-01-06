import { describe, expect, it } from '@jest/globals';
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
  });
});
