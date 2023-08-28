import { join } from 'path';
import { pathToFileURL } from 'url';
import { fetchPonyfill } from '../src/fetch.js';

it('should respect file protocol', async () => {
  const response = await fetchPonyfill(pathToFileURL(join(__dirname, './fixtures/test.json')));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.foo).toBe('bar');
});

describe('data uris', () => {
  it('should accept base64-encoded gif data uri', async () => {
    const b64 = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';
    const res = await fetchPonyfill(b64);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/gif');
    expect(res.headers.get('Content-Length')).toBe('35');
    /*     const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBe(35);
    expect(buf).toBeInstanceOf(ArrayBuffer); */
  });
  it('should accept data uri with specified charset', async () => {
    const r = await fetchPonyfill('data:text/plain;charset=UTF-8;page=21,the%20data:1234,5678');
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toBe('text/plain;charset=UTF-8;page=21');

    const b = await r.text();
    expect(b).toBe('the data:1234,5678');
  });

  it('should accept data uri of plain text', async () => {
    const r = await fetchPonyfill('data:,Hello%20World!');
    expect(r.status).toBe(200);
    const text = await r.text();
    expect(text).toBe('Hello World!');
  });
});
