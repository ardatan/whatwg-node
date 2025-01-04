import { resolveObjectURL } from 'buffer';
import { randomUUID } from 'crypto';
import { PonyfillBlob } from './Blob.js';

export class PonyfillURL extends URL {
  // This part is only needed to handle `PonyfillBlob` objects
  static blobRegistry = new Map<string, Blob | PonyfillBlob>();
  static createObjectURL(blob: Blob): string {
    const blobUrl = `blob:whatwgnode:${randomUUID()}`;
    this.blobRegistry.set(blobUrl, blob);
    return blobUrl;
  }

  static revokeObjectURL(url: string): void {
    if (!this.blobRegistry.has(url)) {
      URL.revokeObjectURL(url);
    } else {
      this.blobRegistry.delete(url);
    }
  }

  static getBlobFromURL(url: string): Blob | PonyfillBlob | undefined {
    return (this.blobRegistry.get(url) || resolveObjectURL(url)) as Blob | PonyfillBlob | undefined;
  }
}
