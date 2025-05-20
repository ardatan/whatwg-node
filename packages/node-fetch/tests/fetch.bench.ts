import { createServer } from 'http';
import { bench, expect } from 'vitest';
import { fetch } from '@whatwg-node/fetch';

createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }
  const body: Buffer[] = [];
  req.on('data', chunk => {
    body.push(chunk);
  });
  req.on('end', () => {
    const buffer = Buffer.concat(body);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(buffer);
  });
}).listen(3000, () => {
  console.log('Server running at http://localhost:3000/');
});

bench('native fetch', async () => {
  const response = await globalThis.fetch('http://localhost:3000', {
    body: JSON.stringify('Hello World'),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const resJson = await response.json();
  expect(resJson).toBe('Hello World');
});

bench('ponyfill fetch', async () => {
  const response = await fetch('http://localhost:3000', {
    body: JSON.stringify('Hello World'),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const resJson = await response.json();
  expect(resJson).toBe('Hello World');
});
