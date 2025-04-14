import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import { describe, expect, it, jest } from '@jest/globals';
import { PonyfillBlob } from '../src/Blob.js';
import { PonyfillBody } from '../src/Body.js';
import { PonyfillTextDecoder } from '../src/TextEncoderDecoder.js';

const exampleData = {
  data: {
    hello: 'world',
  },
};
const examples = {
  Blob: new PonyfillBlob([JSON.stringify(exampleData)], { type: 'application/json' }),
  Buffer: Buffer.from(JSON.stringify(exampleData)),
  ArrayBuffer: new Uint8Array(Buffer.from(JSON.stringify(exampleData))).buffer,
  String: JSON.stringify(exampleData),
  Uint8Array: new Uint8Array(Buffer.from(JSON.stringify(exampleData))),
};

function runExamples(fn: (body: PonyfillBody) => void | Promise<void>) {
  const exampleTypes = Object.keys(examples) as (keyof typeof examples)[];
  exampleTypes.forEach(exampleName => {
    const example = examples[exampleName];
    exampleTypes.forEach(toType => {
      it(`from ${exampleName} to ${toType}`, (): any => {
        const body = new PonyfillBody(example);
        return fn(body);
      });
    });
  });
}

describe('Body', () => {
  describe('should parse correctly', () => {
    runExamples(async body => {
      const result = await body.json();
      expect(result).toMatchObject(exampleData);
    });
  });
  describe('performance optimizations', () => {
    describe('should not generate a body stream', () => {
      runExamples(async body => {
        expect(body['_generatedBody']).toBe(null);
      });
    });
    it('should not create a Blob for a basic text body', async () => {
      const readable = Readable.from(Buffer.from('hello world'));
      const body = new PonyfillBody(readable);
      jest.spyOn(PonyfillBody.prototype, 'blob');
      const result = await body.text();
      expect(result).toBe('hello world');
      expect(body.blob).not.toHaveBeenCalled();
    });
  });
  it('works with empty responses', async () => {
    const body = new PonyfillBody(null);
    const result = await body.text();
    expect(result).toBe('');
  });
  it('works with custom decoding', async () => {
    const body = new PonyfillBody('hello world');
    const buf = await body.bytes();
    const decoder = new PonyfillTextDecoder('utf-8');
    const result = decoder.decode(buf);
    expect(result).toBe('hello world');
  });

  it('throws a TypeError if the body is unable to parse as FormData', async () => {
    const formStr =
      '--Boundary_with_capital_letters\r\n' +
      'Content-Type: application/json\r\n' +
      'Content-Disposition: form-data; name="does_this_work"\r\n' +
      '\r\n' +
      'YES\r\n' +
      '--Boundary_with_capital_letters-Random junk';

    const body = new PonyfillBody(
      new PonyfillBlob([formStr], {
        type: 'multipart/form-data; boundary=Boundary_with_capital_letters',
      }),
    );
    await expect(body.formData()).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Unexpected end of multipart data"`,
    );
  });
});
