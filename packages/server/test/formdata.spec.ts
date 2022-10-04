import { createServerAdapter } from '@whatwg-node/server';
import * as fetchAPI from '@whatwg-node/fetch';
import { createTestServer, TestServer } from './test-server';

describe('FormData', () => {
  let testServer: TestServer;
  beforeAll(async () => {
    testServer = await createTestServer();
  });
  afterAll(done => {
    testServer.server.close(done);
  });
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
    testServer.server.once('request', adapter);
    const formData = new fetchAPI.FormData();
    formData.append('foo', 'bar');
    formData.append('baz', new fetchAPI.File(['baz'], 'baz.txt', { type: 'text/plain' }));
    const response = await fetchAPI.fetch(testServer.url, {
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
