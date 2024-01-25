import { Readable } from 'stream';
import busboy from 'busboy';
import { PonyfillBlob } from './Blob.js';
import { PonyfillFile } from './File.js';
import { getStreamFromFormData, PonyfillFormData } from './FormData.js';
import { PonyfillReadableStream } from './ReadableStream.js';
import { fakePromise, isArrayBufferView } from './utils.js';

enum BodyInitType {
  ReadableStream = 'ReadableStream',
  Blob = 'Blob',
  FormData = 'FormData',
  String = 'String',
  Readable = 'Readable',
  Buffer = 'Buffer',
}

export type BodyPonyfillInit =
  | XMLHttpRequestBodyInit
  | Readable
  | PonyfillReadableStream<Uint8Array>
  | AsyncIterable<Uint8Array>;

export interface FormDataLimits {
  /* Max field name size (in bytes). Default: 100. */
  fieldNameSize?: number;
  /* Max field value size (in bytes). Default: 1MB. */
  fieldSize?: number;
  /* Max number of fields. Default: Infinity. */
  fields?: number;
  /* For multipart forms, the max file size (in bytes). Default: Infinity. */
  fileSize?: number;
  /* For multipart forms, the max number of file fields. Default: Infinity. */
  files?: number;
  /* For multipart forms, the max number of parts (fields + files). Default: Infinity. */
  parts?: number;
  /* For multipart forms, the max number of header key-value pairs to parse. Default: 2000. */
  headerSize?: number;
}

export interface PonyfillBodyOptions {
  formDataLimits?: FormDataLimits;
}

export class PonyfillBody<TJSON = any> implements Body {
  bodyUsed = false;
  contentType: string | null = null;
  contentLength: number | null = null;

  constructor(
    private bodyInit: BodyPonyfillInit | null,
    private options: PonyfillBodyOptions = {},
  ) {
    const { bodyFactory, contentType, contentLength, bodyType, buffer } = processBodyInit(bodyInit);
    this._bodyFactory = bodyFactory;
    this.contentType = contentType;
    this.contentLength = contentLength;
    this.bodyType = bodyType;
    this._buffer = buffer;
  }

  private bodyType?: BodyInitType;

  private _bodyFactory: () => PonyfillReadableStream<Uint8Array> | null = () => null;
  private _generatedBody: PonyfillReadableStream<Uint8Array> | null = null;
  private _buffer?: Buffer;

  private generateBody(): PonyfillReadableStream<Uint8Array> | null {
    if (this._generatedBody) {
      return this._generatedBody;
    }
    const body = this._bodyFactory();
    this._generatedBody = body;
    return body;
  }

  public get body(): PonyfillReadableStream<Uint8Array> | null {
    const _body = this.generateBody();
    if (_body != null) {
      const ponyfillReadableStream = _body;
      const readable = _body.readable;
      return new Proxy(_body.readable as any, {
        get(_, prop) {
          if (prop in ponyfillReadableStream) {
            const ponyfillReadableStreamProp: any = (ponyfillReadableStream as any)[prop];
            if (typeof ponyfillReadableStreamProp === 'function') {
              return ponyfillReadableStreamProp.bind(ponyfillReadableStream);
            }
            return ponyfillReadableStreamProp;
          }
          if (prop in readable) {
            const readableProp: any = (readable as any)[prop];
            if (typeof readableProp === 'function') {
              return readableProp.bind(readable);
            }
            return readableProp;
          }
        },
      });
    }
    return null;
  }

  _collectChunksFromReadable() {
    const _body = this.generateBody();
    if (!_body) {
      return fakePromise([]);
    }
    const chunks: Uint8Array[] = [];
    _body.readable.on('data', chunk => {
      chunks.push(chunk);
    });
    return new Promise<Uint8Array[]>((resolve, reject) => {
      _body.readable.once('end', () => {
        resolve(chunks);
      });
      _body.readable.once('error', e => {
        reject(e);
      });
    });
  }

  blob(): Promise<PonyfillBlob> {
    if (this.bodyType === BodyInitType.Blob) {
      return fakePromise(this.bodyInit as PonyfillBlob);
    }
    if (this._buffer) {
      const blob = new PonyfillBlob([this._buffer], {
        type: this.contentType || '',
        size: this.contentLength,
      });
      return fakePromise(blob);
    }
    return this._collectChunksFromReadable().then(chunks => {
      return new PonyfillBlob(chunks, {
        type: this.contentType || '',
        size: this.contentLength,
      });
    });
  }

  formData(opts?: { formDataLimits: FormDataLimits }): Promise<PonyfillFormData> {
    if (this.bodyType === BodyInitType.FormData) {
      return fakePromise(this.bodyInit as PonyfillFormData);
    }
    const formData = new PonyfillFormData();
    const _body = this.generateBody();
    if (_body == null) {
      return fakePromise(formData);
    }
    const formDataLimits = {
      ...this.options.formDataLimits,
      ...opts?.formDataLimits,
    };
    return new Promise((resolve, reject) => {
      const bb = busboy({
        headers: {
          'content-type': this.contentType || '',
        },
        limits: formDataLimits,
        defParamCharset: 'utf-8',
      });
      bb.on('field', (name, value, { nameTruncated, valueTruncated }) => {
        if (nameTruncated) {
          reject(new Error(`Field name size exceeded: ${formDataLimits?.fieldNameSize} bytes`));
        }
        if (valueTruncated) {
          reject(new Error(`Field value size exceeded: ${formDataLimits?.fieldSize} bytes`));
        }
        formData.set(name, value);
      });
      bb.on('fieldsLimit', () => {
        reject(new Error(`Fields limit exceeded: ${formDataLimits?.fields}`));
      });
      bb.on(
        'file',
        (name, fileStream: Readable & { truncated: boolean }, { filename, mimeType }) => {
          const chunks: BlobPart[] = [];
          fileStream.on('limit', () => {
            reject(new Error(`File size limit exceeded: ${formDataLimits?.fileSize} bytes`));
          });
          fileStream.on('data', chunk => {
            chunks.push(chunk);
          });
          fileStream.on('close', () => {
            if (fileStream.truncated) {
              reject(new Error(`File size limit exceeded: ${formDataLimits?.fileSize} bytes`));
            }
            const file = new PonyfillFile(chunks, filename, { type: mimeType });
            formData.set(name, file);
          });
        },
      );
      bb.on('filesLimit', () => {
        reject(new Error(`Files limit exceeded: ${formDataLimits?.files}`));
      });
      bb.on('partsLimit', () => {
        reject(new Error(`Parts limit exceeded: ${formDataLimits?.parts}`));
      });
      bb.on('close', () => {
        resolve(formData);
      });
      bb.on('error', err => {
        reject(err);
      });
      _body?.readable.pipe(bb);
    });
  }

  arrayBuffer(): Promise<Buffer> {
    if (this._buffer) {
      return fakePromise(this._buffer);
    }
    if (this.bodyType === BodyInitType.Blob) {
      if (this.bodyInit instanceof PonyfillBlob) {
        return this.bodyInit.arrayBuffer();
      }
      const bodyInitTyped = this.bodyInit as Blob;
      return bodyInitTyped
        .arrayBuffer()
        .then(arrayBuffer => Buffer.from(arrayBuffer, undefined, bodyInitTyped.size));
    }
    return this._collectChunksFromReadable().then(
      function concatCollectedChunksFromReadable(chunks) {
        if (chunks.length === 1) {
          return chunks[0] as Buffer;
        }
        return Buffer.concat(chunks);
      },
    );
  }

  json(): Promise<TJSON> {
    return this.text().then(function parseTextAsJson(text) {
      return JSON.parse(text);
    });
  }

  text(): Promise<string> {
    if (this.bodyType === BodyInitType.String) {
      return fakePromise(this.bodyInit as string);
    }
    return this.arrayBuffer().then(buffer => buffer.toString('utf-8'));
  }
}

function processBodyInit(bodyInit: BodyPonyfillInit | null): {
  bodyType?: BodyInitType;
  contentType: string | null;
  contentLength: number | null;
  buffer?: Buffer;
  bodyFactory(): PonyfillReadableStream<Uint8Array> | null;
} {
  if (bodyInit == null) {
    return {
      bodyFactory: () => null,
      contentType: null,
      contentLength: null,
    };
  }
  if (typeof bodyInit === 'string') {
    const buffer = Buffer.from(bodyInit);
    const contentLength = buffer.byteLength;
    return {
      bodyType: BodyInitType.String,
      contentType: 'text/plain;charset=UTF-8',
      contentLength,
      buffer,
      bodyFactory() {
        const readable = Readable.from(buffer);
        return new PonyfillReadableStream<Uint8Array>(readable);
      },
    };
  }
  if (Buffer.isBuffer(bodyInit)) {
    return {
      bodyType: BodyInitType.Buffer,
      contentType: null,
      contentLength: bodyInit.length,
      buffer: bodyInit,
      bodyFactory() {
        const readable = Readable.from(bodyInit);
        const body = new PonyfillReadableStream<Uint8Array>(readable);
        return body;
      },
    };
  }
  if (isArrayBufferView(bodyInit)) {
    const buffer = Buffer.from(bodyInit.buffer, bodyInit.byteOffset, bodyInit.byteLength);
    return {
      bodyType: BodyInitType.Buffer,
      contentLength: bodyInit.byteLength,
      contentType: null,
      buffer,
      bodyFactory() {
        const readable = Readable.from(buffer);
        const body = new PonyfillReadableStream<Uint8Array>(readable);
        return body;
      },
    };
  }
  if (bodyInit instanceof PonyfillReadableStream && bodyInit.readable != null) {
    return {
      bodyType: BodyInitType.ReadableStream,
      bodyFactory: () => bodyInit,
      contentType: null,
      contentLength: null,
    };
  }
  if (isBlob(bodyInit)) {
    return {
      bodyType: BodyInitType.Blob,
      contentType: bodyInit.type,
      contentLength: bodyInit.size,
      bodyFactory() {
        return bodyInit.stream() as PonyfillReadableStream<Uint8Array>;
      },
    };
  }
  if (bodyInit instanceof ArrayBuffer) {
    const contentLength = bodyInit.byteLength;
    const buffer = Buffer.from(bodyInit, undefined, bodyInit.byteLength);
    return {
      bodyType: BodyInitType.Buffer,
      contentType: null,
      contentLength,
      buffer,
      bodyFactory() {
        const readable = Readable.from(buffer);
        const body = new PonyfillReadableStream<Uint8Array>(readable);
        return body;
      },
    };
  }
  if (bodyInit instanceof Readable) {
    return {
      bodyType: BodyInitType.Readable,
      contentType: null,
      contentLength: null,
      bodyFactory() {
        const body = new PonyfillReadableStream<Uint8Array>(bodyInit);
        return body;
      },
    };
  }
  if (isURLSearchParams(bodyInit)) {
    const contentType = 'application/x-www-form-urlencoded;charset=UTF-8';
    return {
      bodyType: BodyInitType.String,
      contentType,
      contentLength: null,
      bodyFactory() {
        const body = new PonyfillReadableStream<Uint8Array>(Readable.from(bodyInit.toString()));
        return body;
      },
    };
  }
  if (isFormData(bodyInit)) {
    const boundary = Math.random().toString(36).substr(2);
    const contentType = `multipart/form-data; boundary=${boundary}`;
    return {
      bodyType: BodyInitType.FormData,
      contentType,
      contentLength: null,
      bodyFactory() {
        return getStreamFromFormData(bodyInit, boundary);
      },
    };
  }

  if ((bodyInit as any)[Symbol.iterator] || (bodyInit as any)[Symbol.asyncIterator]) {
    return {
      contentType: null,
      contentLength: null,
      bodyFactory() {
        const readable = Readable.from(bodyInit);
        return new PonyfillReadableStream(readable);
      },
    };
  }

  throw new Error('Unknown body type');
}

function isFormData(value: any): value is FormData {
  return value?.forEach != null;
}

function isBlob(value: any): value is Blob {
  return value?.stream != null;
}

function isURLSearchParams(value: any): value is URLSearchParams {
  return value?.sort != null;
}
