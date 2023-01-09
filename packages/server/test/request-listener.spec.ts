import { createServerAdapter } from '@whatwg-node/server';
import { Readable } from 'stream';
import { createTestServer, TestServer } from './test-server';
import { createTestContainer } from './create-test-container';

const methodsWithoutBody = ['GET', 'DELETE'];

const methodsWithBody = ['POST', 'PUT', 'PATCH'];

async function compareRequest(toBeChecked: Request, expected: Request) {
  expect(toBeChecked.method).toBe(expected.method);
  expect(toBeChecked.url).toBe(expected.url);
  expected.headers.forEach((value, key) => {
    const toBeCheckedValue = toBeChecked.headers.get(key);
    expect({
      key,
      value: toBeCheckedValue,
    }).toMatchObject({
      key,
      value,
    });
  });
}

async function compareResponse(toBeChecked: Response, expected: Response) {
  expect(toBeChecked.status).toBe(expected.status);
  expected.headers.forEach((value, key) => {
    const toBeCheckedValue = toBeChecked.headers.get(key);
    expect({
      key,
      value: toBeCheckedValue,
    }).toMatchObject({
      key,
      value,
    });
  });
}

describe('Request Listener', () => {
  let testServer: TestServer;
  beforeAll(async () => {
    testServer = await createTestServer();
  });

  afterAll(done => {
    testServer.server.close(done);
  });

  // TODO: add node-fetch here
  createTestContainer(fetchAPI => {
    async function compareReadableStream(toBeCheckedStream: ReadableStream | null, expected: BodyInit | null) {
      if (expected != null) {
        expect(toBeCheckedStream).toBeTruthy();
        const expectedStream = (
          typeof expected === 'object' && Symbol.asyncIterator in expected ? expected : Readable.from(expected as any)
        ) as AsyncIterable<Uint8Array>;
        const expectedIterator = expectedStream[Symbol.asyncIterator]();
        for await (const toBeCheckedChunk of toBeCheckedStream as any as AsyncIterable<Uint8Array>) {
          if (toBeCheckedChunk) {
            const toBeCheckedValues = Buffer.from(toBeCheckedChunk).toString().trim().split('\n');
            for (const toBeCheckedValue of toBeCheckedValues) {
              const trimmedToBeCheckedValue = toBeCheckedValue.trim();
              if (trimmedToBeCheckedValue) {
                const expectedResult = await expectedIterator.next();
                const expectedChunk = expectedResult.value;
                if (expectedChunk) {
                  const expectedValue = Buffer.from(expectedResult.value).toString().trim();
                  if (expectedValue) {
                    expect(trimmedToBeCheckedValue).toBe(expectedValue);
                  }
                }
              }
            }
          }
        }
      }
    }

    async function runTestForRequestAndResponse({
      requestInit,
      expectedResponse,
      getRequestBody,
      getResponseBody,
    }: {
      requestInit: RequestInit;
      expectedResponse: Response;
      getRequestBody: () => BodyInit;
      getResponseBody: () => BodyInit;
    }) {
      const adapter = createServerAdapter(async (request: Request) => {
        await compareRequest(request, expectedRequest);
        if (methodsWithBody.includes(expectedRequest.method)) {
          await compareReadableStream(request.body, getRequestBody());
        }
        return expectedResponse;
      }, fetchAPI.Request);
      testServer.server.once('request', adapter);
      const expectedRequest = new fetchAPI.Request(testServer.url, requestInit);
      const returnedResponse = await fetchAPI.fetch(expectedRequest);
      await compareResponse(returnedResponse, expectedResponse);
      await compareReadableStream(returnedResponse.body, getResponseBody());
    }

    function getRegularRequestBody() {
      return JSON.stringify({ requestFoo: 'requestFoo' });
    }

    function getRegularResponseBody() {
      return JSON.stringify({ responseFoo: 'responseFoo' });
    }

    function getIncrementalRequestBody() {
      return new fetchAPI.ReadableStream({
        async start(controller) {
          for (let i = 0; i < 2; i++) {
            await new Promise(resolve => setTimeout(resolve, 30));
            controller.enqueue(`data: request_${i.toString()}\n`);
          }
          controller.close();
        },
      });
    }

    function getIncrementalResponseBody() {
      return new fetchAPI.ReadableStream({
        async start(controller) {
          for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 30));
            controller.enqueue(`data: response_${i.toString()}\n`);
          }
          controller.close();
        },
      });
    }

    [...methodsWithBody, ...methodsWithoutBody].forEach(method => {
      it(`should handle regular requests with ${method}`, async () => {
        const requestInit: RequestInit = {
          method,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'random-header': Date.now().toString(),
          },
        };
        if (methodsWithBody.includes(method)) {
          requestInit.body = getRegularRequestBody();
        }
        const expectedResponse = new fetchAPI.Response(getRegularResponseBody(), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'random-header': Date.now().toString(),
          },
        });
        await runTestForRequestAndResponse({
          requestInit,
          getRequestBody: getRegularRequestBody,
          expectedResponse,
          getResponseBody: getRegularResponseBody,
        });
      });

      it(`should handle incremental responses with ${method}`, async () => {
        const requestInit: RequestInit = {
          method,
          headers: {
            accept: 'application/json',
            'random-header': Date.now().toString(),
          },
        };
        if (methodsWithBody.includes(method)) {
          requestInit.body = getRegularRequestBody();
        }
        const expectedResponse = new fetchAPI.Response(getIncrementalResponseBody(), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'random-header': Date.now().toString(),
          },
        });
        await runTestForRequestAndResponse({
          requestInit,
          getRequestBody: getRegularRequestBody,
          expectedResponse,
          getResponseBody: getIncrementalResponseBody,
        });
      });

      it(`should handle incremental requests with ${method}`, async () => {
        const requestInit: RequestInit = {
          method,
          headers: {
            accept: 'application/json',
            'random-header': Date.now().toString(),
          },
        };
        if (methodsWithBody.includes(method)) {
          requestInit.body = getIncrementalRequestBody();
        }
        const expectedResponse = new fetchAPI.Response(getRegularResponseBody(), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'random-header': Date.now().toString(),
          },
        });
        await runTestForRequestAndResponse({
          requestInit,
          getRequestBody: getIncrementalRequestBody,
          expectedResponse,
          getResponseBody: getRegularResponseBody,
        });
      });
    });

    it.only('should have the abort signal on the request', async () => {
      const handler = jest.fn((_request: Request) => new fetchAPI.Response());
      const adapter = createServerAdapter(handler, fetchAPI.Request);

      await adapter.fetch('http://localhost');

      expect(handler.mock.lastCall?.[0].signal).toBeTruthy();
    });
  });
});
