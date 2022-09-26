import { createFetch } from '@whatwg-node/fetch';
import { createServerAdapter } from '@whatwg-node/server';
import { createServer, Server } from 'http';

describe('FormData', () => {
  let server: Server;
  let url: string;
  afterEach(done => {
    server.close(done);
  });
  ['fieldsFirst:true', 'fieldsFirst:false'].forEach(fieldsFirstFlag => {
    const fetchAPI = createFetch({
      formDataLimits: {
        fieldsFirst: fieldsFirstFlag === 'fieldsFirst:true',
      },
    });

    describe(fieldsFirstFlag, () => {
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
            return new fetchAPI.Response(e.stack, {
              status: 500,
            });
          }
          return new fetchAPI.Response(null, {
            status: 204,
          });
        }, fetchAPI.Request);
        server = createServer(adapter);
        await new Promise<void>(resolve => {
          server.listen(0, () => {
            url = `http://localhost:${(server.address() as any).port}`;
            resolve();
          });
        });
        const formData = new fetchAPI.FormData();
        formData.append('foo', 'bar');
        formData.append('baz', new fetchAPI.File(['baz'], 'baz.txt', { type: 'text/plain' }));
        const response = await fetchAPI.fetch(url, {
          method: 'POST',
          body: formData,
        });
        expect(await response.text()).toBe('');
        expect(response.status).toBe(204);
        expect(receivedFieldContent).toBe('bar');
        expect(receivedFileName).toBe('baz.txt');
        expect(receivedFileType).toBe('text/plain');
        expect(receivedFileContent).toBe('baz');
      });
    });
  });
});
