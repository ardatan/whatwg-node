import { useContentEncoding } from '../src/plugins/useContentEncoding';
import { SUPPORTED_ENCODINGS } from '../src/utils';
import { runTestsForEachFetchImpl } from './test-fetch';
import { runTestsForEachServerImpl } from './test-server';

describe('Compression', () => {
  const exampleData = JSON.stringify({
    hello: 'world',
  });
  describe('Adapter', () => {
    runTestsForEachFetchImpl(
      (_, { fetchAPI, createServerAdapter }) => {
        for (const encoding of SUPPORTED_ENCODINGS) {
          describe(encoding, () => {
            it('from the server to the client', async () => {
              const adapter = createServerAdapter(() => new fetchAPI.Response(exampleData), {
                plugins: [useContentEncoding()],
              });
              const res = await adapter.fetch('/', {
                headers: {
                  'accept-encoding': encoding,
                },
              });
              expect(res.status).toEqual(200);
              await expect(res.text()).resolves.toEqual(exampleData);
            });
            it('from the client to the server', async () => {
              const adapter = createServerAdapter(
                async req => {
                  const body = await req.text();
                  return new fetchAPI.Response(body);
                },
                {
                  plugins: [useContentEncoding()],
                },
              );
              const stream = new CompressionStream(encoding);
              const writer = stream.writable.getWriter();
              writer.write(exampleData);
              writer.close();
              const res = await adapter.fetch('/', {
                method: 'POST',
                headers: {
                  'content-encoding': encoding,
                },
                body: stream.readable,
                duplex: 'half',
              });
              await expect(res.text()).resolves.toEqual(exampleData);
            });
          });
        }
      },
      { noLibCurl: true },
    );
  });
  runTestsForEachFetchImpl((_, { fetchAPI, createServerAdapter }) => {
    runTestsForEachServerImpl(server => {
      for (const encoding of SUPPORTED_ENCODINGS) {
        describe(encoding, () => {
          it(`from the server to the client`, async () => {
            const adapter = createServerAdapter(() => new fetchAPI.Response(exampleData), {
              plugins: [useContentEncoding()],
            });
            server.addOnceHandler(adapter);
            const res = await fetchAPI.fetch(server.url, {
              headers: {
                'accept-encoding': encoding,
              },
            });
            expect(res.headers.get('content-encoding')).toEqual(encoding);
            expect(res.status).toEqual(200);
            await expect(res.text()).resolves.toEqual(exampleData);
          });
          it(`from the client to the server`, async () => {
            const adapter = createServerAdapter(
              async req => {
                const body = await req.text();
                return new fetchAPI.Response(body);
              },
              {
                plugins: [useContentEncoding()],
              },
            );
            server.addOnceHandler(adapter);
            const stream = new CompressionStream(encoding);
            const writer = stream.writable.getWriter();
            writer.write(exampleData);
            writer.close();
            const res = await fetchAPI.fetch(server.url, {
              method: 'POST',
              headers: {
                'content-encoding': encoding,
              },
              body: stream.readable,
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore - not in the types yet
              duplex: 'half',
            });
            await expect(res.text()).resolves.toEqual(exampleData);
          });
        });
      }
    });
  });
});
