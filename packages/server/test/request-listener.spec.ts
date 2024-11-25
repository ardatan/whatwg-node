import { setTimeout } from 'timers/promises';
import { runTestsForEachFetchImpl } from './test-fetch.js';
import { runTestsForEachServerImpl, TestServer } from './test-server.js';

const methodsWithoutBody = ['GET', 'DELETE'];

const methodsWithBody = ['POST', 'PUT', 'PATCH'];

describe('Request Listener', () => {
  runTestsForEachFetchImpl((impl, { createServerAdapter, fetchAPI }) => {
    runTestsForEachServerImpl(testServer => {
      [...methodsWithBody, ...methodsWithoutBody].forEach(method => {
        // PATCH is buggy in Native
        if (impl === 'native' && method === 'PATCH') return;
        it(`should handle regular requests with ${method}`, () => {
          const requestInit: RequestInit = {
            method,
            headers: {
              accept: 'application/json;charset=utf-8',
              'content-type': 'application/json;charset=utf-8',
              'random-header': Date.now().toString(),
            },
          };
          if (methodsWithBody.includes(method)) {
            requestInit.body = getRegularRequestBody();
          }
          const expectedResponse = new fetchAPI.Response(getRegularResponseBody(), {
            status: 200,
            headers: {
              accept: 'application/json;charset=utf-8',
              'random-header': Date.now().toString(),
            },
          });
          return runTestForRequestAndResponse({
            requestInit,
            getRequestBody: getRegularRequestBody,
            expectedResponse,
            getResponseBody: getRegularResponseBody,
            testServer,
          });
        });

        it(`should handle incremental responses with ${method}`, () => {
          const requestInit: RequestInit = {
            method,
            headers: {
              accept: 'application/json;charset=utf-8',
              'random-header': Date.now().toString(),
            },
          };
          if (methodsWithBody.includes(method)) {
            requestInit.body = getRegularRequestBody();
          }
          const expectedResponse = new fetchAPI.Response(getIncrementalResponseBody(), {
            status: 200,
            headers: {
              accept: 'application/json;charset=utf-8',
              'random-header': Date.now().toString(),
            },
          });
          return runTestForRequestAndResponse({
            requestInit,
            getRequestBody: getRegularRequestBody,
            expectedResponse,
            getResponseBody: getIncrementalResponseBody,
            testServer,
          });
        });

        it(`should handle incremental requests with ${method}`, () => {
          const requestInit: RequestInit = {
            method,
            headers: {
              accept: 'application/json;charset=utf-8',
              'random-header': Date.now().toString(),
            },
            // @ts-expect-error duplex is not part of the RequestInit type yet
            duplex: 'half',
          };
          if (methodsWithBody.includes(method)) {
            requestInit.body = getIncrementalRequestBody();
          }
          const expectedResponse = new fetchAPI.Response(getRegularResponseBody(), {
            status: 200,
            headers: {
              'content-type': 'application/json;charset=utf-8',
              'random-header': Date.now().toString(),
            },
          });
          return runTestForRequestAndResponse({
            requestInit,
            getRequestBody: getIncrementalRequestBody,
            expectedResponse,
            getResponseBody: getRegularResponseBody,
            testServer,
          });
        });
      });
    });
    async function compareRequest(toBeChecked: Request, expected: Request) {
      expect(toBeChecked.method).toBe(expected.method);
      // expect(toBeChecked.url).toBe(expected.url);
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
      expect(toBeChecked.status).toBe(expected.status);
    }
    async function compareReadableStream(
      toBeCheckedStream: ReadableStream | null,
      expected: BodyInit | null,
    ) {
      const toBeCheckedValues = [];
      const expectedValues = [];
      if (toBeCheckedStream) {
        for await (const chunk of toBeCheckedStream as any) {
          if (chunk) {
            const chunkString = Buffer.from(chunk).toString('utf-8');
            if (chunkString) {
              const chunkParts = chunkString.trim().split('\n');
              for (const chunkPart of chunkParts) {
                toBeCheckedValues.push(chunkPart);
              }
            }
          }
        }
        if (expected) {
          if (typeof expected === 'string') {
            expectedValues.push(expected);
          } else {
            for await (const chunk of expected as any) {
              if (chunk) {
                const chunkString = Buffer.from(chunk).toString('utf-8');
                if (chunkString) {
                  const chunkParts = chunkString.trim().split('\n');
                  for (const chunkPart of chunkParts) {
                    expectedValues.push(chunkPart);
                  }
                }
              }
            }
          }
          const toBeCheckedValuesString = toBeCheckedValues.join('\n');
          const expectedValuesString = expectedValues.join('\n');
          expect(toBeCheckedValuesString).toBe(expectedValuesString);
        }
      }
    }

    async function runTestForRequestAndResponse({
      requestInit,
      expectedResponse,
      getRequestBody,
      getResponseBody,
      testServer,
    }: {
      requestInit: RequestInit;
      expectedResponse: Response;
      getRequestBody: () => BodyInit;
      getResponseBody: () => BodyInit;
      testServer: TestServer;
    }) {
      const adapter = createServerAdapter(async (request: Request) => {
        await compareRequest(request, expectedRequest);
        if (methodsWithBody.includes(expectedRequest.method)) {
          await compareReadableStream(request.body, getRequestBody());
        }
        return expectedResponse;
      });
      await testServer.addOnceHandler(adapter);
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
      let i = 5;
      return new fetchAPI.ReadableStream({
        async pull(controller) {
          await setTimeout(30);
          if (i > 0) {
            controller.enqueue(`data: request_${i.toString()}\n`);
            i--;
          } else {
            controller.close();
          }
        },
      });
    }

    function getIncrementalResponseBody() {
      let i = 5;
      return new fetchAPI.ReadableStream({
        async pull(controller) {
          await setTimeout(30);
          if (i > 0) {
            controller.enqueue(`data: response_${i.toString()}\n`);
            i--;
          } else {
            controller.close();
          }
        },
      });
    }
  });
});
