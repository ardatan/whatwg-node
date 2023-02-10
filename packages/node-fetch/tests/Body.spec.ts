import { Readable } from 'stream';
import { PonyfillBlob } from '../src/Blob';
import { PonyfillBody } from '../src/Body';

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
  const exampleTypes = Object.keys(examples);
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
    });
  });
});
