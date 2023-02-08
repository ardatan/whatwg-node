import { Blob as NodeBlob } from 'buffer';
import { PonyfillReadableStream } from './ReadableStream';

class DummyBlob {
  constructor() {
    throw new Error(
      'Blob is not supported in this environment, if you are using an older version of Node v14, please upgrade to v14.17.0 or higher',
    );
  }
}

const BaseBlob = (NodeBlob || DummyBlob)

// Will be removed after v14 reaches EOL
// Needed because v14 doesn't have .stream() implemented
export class PonyfillBlob extends BaseBlob implements Blob {
  stream(): any {
    return new PonyfillReadableStream({
      start: async controller => {
        const arrayBuffer = await this.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        controller.enqueue(buffer);
        controller.close();
      },
    });
  }

  slice(...args: any[]): any {
    return super.slice(...args);
  }
}

export interface PonyfillBlob {
  prototype: Blob;
  new (blobParts?: BlobPart[], options?: BlobPropertyBag): Blob;
}
