import { Blob as NodeBlob } from 'buffer';
import { isArrayBuffer, PonyfillBlob } from '../src/Blob';

describe('Blob', () => {
  const blobParts: Record<string, BlobPart> = {
    string: 'string',
    globalBlob: new Blob(['globalBlob']),
    nodeBlob: new NodeBlob(['nodeBlob']) as Blob,
    arrayBuffer: Buffer.from('arrayBuffer'),
  };
  for (const [name, blobPart] of Object.entries(blobParts)) {
    describe(name, () => {
      describe('arrayBuffer', () => {
        it('content', async () => {
          const blob = new PonyfillBlob([blobPart]);
          const buffer = await blob.arrayBuffer();
          expect(isArrayBuffer(buffer)).toBe(true);
          expect(Buffer.from(buffer, undefined, buffer.byteLength).toString('utf-8')).toBe(name);
        });
        it('size', async () => {
          const blob = new PonyfillBlob([blobPart]);
          const buffer = await blob.arrayBuffer();
          expect(blob.size).toBe(buffer.byteLength);
        });
      });
      describe('text', () => {
        it('content', async () => {
          const blob = new PonyfillBlob([blobPart]);
          const text = await blob.text();
          expect(typeof text).toBe('string');
          expect(text).toBe(name);
        });
        it('size', async () => {
          const blob = new PonyfillBlob([blobPart]);
          const text = await blob.text();
          expect(blob.size).toBe(Buffer.byteLength(text));
        });
      });
      describe('stream', () => {
        it('content', async () => {
          const blob = new PonyfillBlob([blobPart]);
          const stream = blob.stream();
          expect(typeof stream[Symbol.asyncIterator]).toBe('function');
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          expect(Buffer.concat(chunks).toString('utf-8')).toBe(name);
        });
        it('size', async () => {
          const blob = new PonyfillBlob([blobPart]);
          const stream = blob.stream();
          let size = 0;
          for await (const chunk of stream) {
            size += chunk.length;
          }
          expect(blob.size).toBe(size);
        });
      });
    });
  }
});
