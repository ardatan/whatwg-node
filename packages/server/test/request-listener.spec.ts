import { createServerAdapter } from '@whatwg-node/server';
import { Readable } from 'stream';
import { createTestServer, TestServer } from './test-server';
import * as fetchAPI from '@whatwg-node/fetch';

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

  async function compareReadableStream(toBeCheckedStream: ReadableStream | null, expected: BodyInit | null) {
    const toBeCheckedValues = [];
    const expectedValues = [];
    if (toBeCheckedStream) {
      for await (const chunk of Readable.from(toBeCheckedStream as any)) {
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
        for await (const chunk of Readable.from(expected as any)) {
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

    it('should have the abort signal on the request', async () => {
      const handler = jest.fn((_request: Request) => new fetchAPI.Response());
      const adapter = createServerAdapter(handler, fetchAPI.Request);

      await adapter.fetch('http://localhost');

      expect(handler.mock.lastCall?.[0].signal).toBeTruthy();
    });
  });
});
