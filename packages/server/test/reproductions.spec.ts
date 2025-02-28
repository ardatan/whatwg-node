import { Server } from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import { expect, it } from '@jest/globals';
import { createServerAdapter, Response } from '@whatwg-node/server';

it('bun issue#12368', async () => {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  const echoAdapter = createServerAdapter(req =>
    req.json().then(body =>
      Response.json({
        body,
        url: req.url,
      }),
    ),
  );

  app.use('/my-path', echoAdapter);

  const server = await new Promise<Server>((resolve, reject) => {
    const server = app.listen(0, err => (err ? reject(err) : resolve(server)));
  });

  const port = (server.address() as AddressInfo).port;

  const response = await fetch(`http://localhost:${port}/my-path`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hello: 'world' }),
  });

  const bodyText = await response.text();
  expect(bodyText).toEqual(
    JSON.stringify({
      body: { hello: 'world' },
      url: `http://localhost:${port}/my-path`,
    }),
  );
});
