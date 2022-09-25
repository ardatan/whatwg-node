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
        expect.assertions(4);
        const adapter = createServerAdapter(async request => {
          const body = await request.formData();
          expect(body.get('foo')).toBe('bar');
          const file = body.get('baz') as File;
          expect(file.name).toBe('baz.txt');
          expect(file.type).toBe('text/plain');
          expect(await file.text()).toBe('baz');
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
        await response.text();
      });
    });
  });
});
