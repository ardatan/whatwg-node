import { createServerAdapter } from '@whatwg-node/server';
import { createFetch } from '@whatwg-node/fetch';
import { Readable } from 'stream';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';

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

async function compareReadableStream(toBeChecked: ReadableStream | null, expected: BodyInit | null) {
  if (expected != null) {
    expect(toBeChecked).toBeTruthy();
    const expectedBody = new Response(expected).body;
    const expectedStream = Readable.from(expectedBody as any);
    const expectedIterator = expectedStream[Symbol.asyncIterator]();
    const toBeCheckedStream = Readable.from(toBeChecked as any);
    for await (const toBeCheckedChunk of toBeCheckedStream) {
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

let server: Server;
let url: string;

describe('Request Listener', () => {
  beforeEach(done => {
    server = createServer();
    server.listen(0, () => {
      url = `http://localhost:${(server.address() as AddressInfo).port}`;
      done();
    })
  });

  afterEach(done => {
    server.close(done);
  });

  ['node-fetch', 'default-fetch'].forEach(fetchImplementation => {
    describe(fetchImplementation, () => {
      const fetchAPI = createFetch({
        useNodeFetch: fetchImplementation === 'node-fetch',
      });

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
        });
        server.addListener('request', adapter);
        const expectedRequest = new fetchAPI.Request(url, requestInit);
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
    });
  });

});
