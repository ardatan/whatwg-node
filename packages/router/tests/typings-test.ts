import express from 'express';
import { createServerAdapter } from '@whatwg-node/server';
import { TypedResponseWithJSONStatusMap } from '@whatwg-node/typed-fetch';
import { createRouter, Response, RouterHandler } from '../src';

const router = createRouter();
const adapter = createServerAdapter(() => new Response('Hello World'));

// express-compat
const app = express();
app.use('/router', router);
app.use('/adapter', adapter);

type TestGetOpts = {
  Request: {
    QueryParams: {
      id: string;
    };
    Headers: {
      Authorization: `Bearer ${string}`;
    };
  };
  Responses: {
    200: {
      id: string;
      name: string;
    };
    401: {
      code: string;
      message: string;
    };
    404: {
      message: string;
    };
  };
};

const handler: RouterHandler<
  any,
  'get',
  unknown,
  TestGetOpts['Request']['Headers'],
  TestGetOpts['Request']['QueryParams'],
  any,
  TestGetOpts['Responses']
> = (request): TypedResponseWithJSONStatusMap<TestGetOpts['Responses']> => {
  // @ts-expect-error - a is not defined in headers
  request.headers.set('a', '2');
  if (!request.headers.has('Authorization')) {
    return Response.json(
      {
        code: 'UNAUTHORIZED',
        message: 'Bearer token is missing',
      },
      {
        status: 401,
      },
    );
  }
  const id = request.parsedUrl.searchParams.get('id');
  // @ts-expect-error - name is not defined
  const name = request.parsedUrl.searchParams.get('name');
  if (id === 'only_available_id') {
    return Response.json(
      {
        id,
        name: `The only one`,
      },
      {
        status: 200,
      },
    );
  }
  // @ts-expect-error - message is string
  return Response.json(
    {
      message: 1,
    },
    {
      status: 404,
    },
  );
};

// custom types
router.get<TestGetOpts>('/pet', handler).put<{
  Request: {
    JSON: {
      name: string;
    };
  };
  Responses: {
    200: {
      id: string;
    };
    400: {
      message: string;
    };
  };
}>('/pet', async request => {
  const a = await request.json();
  a.name = '2';
  // @ts-expect-error - name is string
  a.name = 2;
  if (a.name.length < 3) {
    return Response.json(
      {
        message: 'Name is invalid',
      },
      {
        status: 400,
      },
    );
  }
  return Response.json(
    {
      id: 'TEST_ID',
    },
    {
      status: 200,
    },
  );
});
