import { PonyfillFile } from './File';
import { PonyfillBlob } from './Blob';
import { PonyfillReadableStream } from './ReadableStream';

export class PonyfillFormData implements FormData {
  private map = new Map<string, FormDataEntryValue[]>();

  append(name: string, value: PonyfillBlob | string, fileName?: string): void {
    let values = this.map.get(name);
    if (!values) {
      values = [];
      this.map.set(name, values);
    }
    const entry: FormDataEntryValue = value instanceof PonyfillBlob ? getNormalizedFile(name, value, fileName) : value;
    values.push(entry);
  }

  delete(name: string): void {
    this.map.delete(name);
  }

  get(name: string): FormDataEntryValue | null {
    const values = this.map.get(name);
    return values ? values[0] : null;
  }

  getAll(name: string): FormDataEntryValue[] {
    return this.map.get(name) || [];
  }

  has(name: string): boolean {
    return this.map.has(name);
  }

  set(name: string, value: PonyfillBlob | string, fileName?: string): void {
    const entry: FormDataEntryValue = value instanceof PonyfillBlob ? getNormalizedFile(name, value, fileName) : value;
    this.map.set(name, [entry]);
  }

  *[Symbol.iterator](): IterableIterator<[string, FormDataEntryValue]> {
    for (const [key, values] of this.map) {
      for (const value of values) {
        yield [key, value];
      }
    }
  }

  forEach(callback: (value: FormDataEntryValue, key: string, parent: this) => void): void {
    for (const [key, value] of this) {
      callback(value, key, this);
    }
  }

  stream(boundary = '---'): PonyfillReadableStream<Uint8Array> {
    const entries: [string, string | PonyfillFile][] = [];
    return new PonyfillReadableStream<Buffer>({
      start: async controller => {
        controller.enqueue(Buffer.from(`--${boundary}\r\n`));
        this.forEach((value, key) => {
          entries.push([key, value]);
        });
      },
      pull: async controller => {
        const entry = entries.shift();
        if (entry) {
          const [key, value] = entry;
          if (value instanceof PonyfillBlob) {
            let filenamePart = '';
            if (value.name) {
              filenamePart = `; filename="${value.name}"`;
            }
            controller.enqueue(Buffer.from(`Content-Disposition: form-data; name="${key}"${filenamePart}\r\n`));
            controller.enqueue(Buffer.from(`Content-Type: ${value.type || 'application/octet-stream'}\r\n\r\n`));
            controller.enqueue(Buffer.from(await value.arrayBuffer()));
          } else {
            controller.enqueue(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`));
            controller.enqueue(Buffer.from(value));
          }
          if (entries.length === 0) {
            controller.enqueue(Buffer.from(`\r\n--${boundary}--\r\n`));
            controller.close();
          } else {
            controller.enqueue(Buffer.from(`\r\n--${boundary}\r\n`));
          }
        } else {
          controller.enqueue(Buffer.from(`\r\n--${boundary}--\r\n`));
          controller.close();
        }
      },
    });
  }
}

function getNormalizedFile(name: string, blob: PonyfillBlob, fileName?: string) {
  if (blob instanceof PonyfillFile) {
    if (fileName != null) {
      return new PonyfillFile([blob], fileName, { type: blob.type, lastModified: blob.lastModified });
    }
    return blob;
  }
  return new PonyfillFile([blob], fileName || name, { type: blob.type });
}
