import NodeBuffer from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { PonyfillBlob } from './Blob.js';

const NativeURL = globalThis.URL;

class URL extends NativeURL {
  // This part is only needed to handle `PonyfillBlob` objects
  static blobRegistry = new Map<string, Blob | PonyfillBlob>();
  static createObjectURL(blob: Blob): string {
    const blobUrl = `blob:whatwgnode:${randomUUID()}`;
    this.blobRegistry.set(blobUrl, blob);
    return blobUrl;
  }

  static revokeObjectURL(url: string): void {
    if (!this.blobRegistry.has(url)) {
      NativeURL.revokeObjectURL(url);
    } else {
      this.blobRegistry.delete(url);
    }
  }

  static getBlobFromURL(url: string): Blob | PonyfillBlob | undefined {
    return (this.blobRegistry.get(url) || NodeBuffer?.resolveObjectURL?.(url)) as
      | Blob
      | PonyfillBlob
      | undefined;
  }
}

export { URL as PonyfillURL };
