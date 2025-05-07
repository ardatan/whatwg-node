import { Buffer } from 'node:buffer';
import { PonyfillBlob } from './Blob.js';
import { PonyfillFile } from './File.js';
import { PonyfillIteratorObject } from './IteratorObject.js';
import { PonyfillReadableStream } from './ReadableStream.js';

export class PonyfillFormData implements FormData {
  private map = new Map<string, FormDataEntryValue[]>();

  append(name: string, value: string): void;
  append(name: string, value: PonyfillBlob, fileName?: string): void;
  append(name: string, value: PonyfillBlob | string, fileName?: string): void {
    let values = this.map.get(name);
    if (!values) {
      values = [];
      this.map.set(name, values);
    }
    const entry: FormDataEntryValue = isBlob(value)
      ? getNormalizedFile(name, value, fileName)
      : value;
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

  set(name: string, value: string): void;
  set(name: string, value: PonyfillBlob, fileName?: string): void;
  set(name: string, value: PonyfillBlob | string, fileName?: string): void {
    const entry: FormDataEntryValue = isBlob(value)
      ? getNormalizedFile(name, value, fileName)
      : value;
    this.map.set(name, [entry]);
  }

  [Symbol.iterator](): FormDataIterator<[string, FormDataEntryValue]> {
    return this._entries();
  }

  *_entries(): FormDataIterator<[string, FormDataEntryValue]> {
    for (const [key, values] of this.map) {
      for (const value of values) {
        yield [key, value];
      }
    }
  }

  entries(): FormDataIterator<[string, FormDataEntryValue]> {
    return new PonyfillIteratorObject(this._entries(), 'FormDataIterator');
  }

  _keys(): IterableIterator<string> {
    return this.map.keys();
  }

  keys(): FormDataIterator<string> {
    return new PonyfillIteratorObject(this._keys(), 'FormDataIterator');
  }

  *_values(): IterableIterator<FormDataEntryValue> {
    for (const values of this.map.values()) {
      for (const value of values) {
        yield value;
      }
    }
  }

  values(): FormDataIterator<FormDataEntryValue> {
    return new PonyfillIteratorObject(this._values(), 'FormDataIterator');
  }

  forEach(callback: (value: FormDataEntryValue, key: string, parent: this) => void): void {
    for (const [key, value] of this) {
      callback(value, key, this);
    }
  }
}

export function getStreamFromFormData(
  formData: FormData,
  boundary = '---',
): PonyfillReadableStream<Uint8Array> {
  let entriesIterator: FormDataIterator<[string, FormDataEntryValue]>;
  let sentInitialHeader = false;
  let currentAsyncIterator: AsyncIterator<[string, FormDataEntryValue]> | undefined;
  let hasBefore = false;
  function handleNextEntry(controller: ReadableStreamController<Buffer>) {
    const { done, value } = entriesIterator.next();
    if (done) {
      controller.enqueue(Buffer.from(`\r\n--${boundary}--\r\n`));
      return controller.close();
    }
    if (hasBefore) {
      controller.enqueue(Buffer.from(`\r\n--${boundary}\r\n`));
    }
    if (value) {
      const [key, blobOrString] = value;
      if (typeof blobOrString === 'string') {
        controller.enqueue(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`));
        controller.enqueue(Buffer.from(blobOrString));
      } else {
        let filenamePart = '';
        if (blobOrString.name) {
          filenamePart = `; filename="${blobOrString.name}"`;
        }
        controller.enqueue(
          Buffer.from(`Content-Disposition: form-data; name="${key}"${filenamePart}\r\n`),
        );
        controller.enqueue(
          Buffer.from(`Content-Type: ${blobOrString.type || 'application/octet-stream'}\r\n\r\n`),
        );
        const entryStream: any = blobOrString.stream();
        currentAsyncIterator = entryStream[Symbol.asyncIterator]();
      }
      hasBefore = true;
    }
  }
  return new PonyfillReadableStream<Buffer>({
    start: () => {
      entriesIterator = formData.entries();
    },
    pull: controller => {
      if (!sentInitialHeader) {
        sentInitialHeader = true;
        return controller.enqueue(Buffer.from(`--${boundary}\r\n`));
      }
      if (currentAsyncIterator) {
        return currentAsyncIterator.next().then(({ done, value }) => {
          if (done) {
            currentAsyncIterator = undefined;
          }
          if (value) {
            return controller.enqueue(value);
          } else {
            return handleNextEntry(controller);
          }
        });
      }
      return handleNextEntry(controller);
    },
    cancel: err => {
      entriesIterator?.return?.(err);
      currentAsyncIterator?.return?.(err);
    },
  });
}

function getNormalizedFile(name: string, blob: PonyfillBlob, fileName?: string) {
  Object.defineProperty(blob as PonyfillFile, 'name', {
    configurable: true,
    enumerable: true,
    value: fileName || blob.name || name,
  });
  return blob as PonyfillFile;
}

function isBlob(value: any): value is PonyfillBlob {
  return value?.arrayBuffer != null;
}
