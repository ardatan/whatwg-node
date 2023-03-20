import { PonyfillBlob } from './Blob.js';

export class PonyfillFile extends PonyfillBlob implements File {
  public lastModified: number;
  constructor(fileBits: BlobPart[], public name: string, options?: FilePropertyBag) {
    super(fileBits, options);
    this.lastModified = options?.lastModified || Date.now();
  }

  public webkitRelativePath = '';
}
