import { PonyfillBlob } from './Blob';
import { Readable } from 'stream';
import { PonyfillFormData } from './FormData';
import { PonyfillReadableStream } from './ReadableStream';
import { PonyfillFile } from './File';
import busboy from 'busboy';

enum BodyInitType {
  ReadableStream = 'ReadableStream',
  Blob = 'Blob',
  FormData = 'FormData',
  ArrayBuffer = 'ArrayBuffer',
  String = 'String',
  Readable = 'Readable',
}

export type BodyPonyfillInit = XMLHttpRequestBodyInit | Readable | PonyfillReadableStream<Uint8Array>;

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
  private _body: PonyfillReadableStream<Uint8Array> | null = null;
  contentType: string | null = null;
  contentLength: number | null = null;

  constructor(private bodyInit: BodyPonyfillInit | null, private options: PonyfillBodyOptions = {}) {
    const { body, contentType, contentLength, bodyType } = processBodyInit(bodyInit);
    this._body = body;
    this.contentType = contentType;
    this.contentLength = contentLength;
    this.bodyType = bodyType;
  }

  private bodyType?: BodyInitType;

  public get body(): PonyfillReadableStream<Uint8Array> | null {
    if (this._body != null) {
      const ponyfillReadableStream = this._body;
      const readable = this._body.readable;
      return new Proxy(this._body.readable as any, {
        get(_, prop) {
          if (prop in ponyfillReadableStream) {
            const ponyfillReadableStreamProp: any = ponyfillReadableStream[prop];
            if (typeof ponyfillReadableStreamProp === 'function') {
              return ponyfillReadableStreamProp.bind(ponyfillReadableStream);
            }
            return ponyfillReadableStreamProp;
          }
          if (prop in readable) {
            const readableProp: any = readable[prop];
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

  async arrayBuffer(): Promise<ArrayBuffer> {
    if (this.bodyType === BodyInitType.ArrayBuffer) {
      return this.bodyInit as ArrayBuffer;
    }
    const blob = await this.blob();
    return blob.arrayBuffer();
  }

  async blob(): Promise<PonyfillBlob> {
    if (this.bodyType === BodyInitType.Blob) {
      return this.bodyInit as PonyfillBlob;
    }
    const chunks: Uint8Array[] = [];
    if (this._body) {
      for await (const chunk of this._body.readable) {
        chunks.push(chunk);
      }
    }
    return new PonyfillBlob(chunks);
  }

  formData(opts?: { formDataLimits: FormDataLimits }): Promise<PonyfillFormData> {
    if (this.bodyType === BodyInitType.FormData) {
      return Promise.resolve(this.bodyInit as PonyfillFormData);
    }
    const formData = new PonyfillFormData();
    if (this._body == null) {
      return Promise.resolve(formData);
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
      bb.on('file', (name, fileStream: Readable & { truncated: boolean }, { filename, mimeType }) => {
        const chunks: BlobPart[] = [];
        fileStream.on('limit', () => {
          reject(new Error(`File size limit exceeded: ${formDataLimits?.fileSize} bytes`));
        });
        fileStream.on('data', chunk => {
          chunks.push(Buffer.from(chunk));
        });
        fileStream.on('close', () => {
          if (fileStream.truncated) {
            reject(new Error(`File size limit exceeded: ${formDataLimits?.fileSize} bytes`));
          }
          const file = new PonyfillFile(chunks, filename, { type: mimeType });
          formData.set(name, file);
        });
      });
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
      this._body?.readable.pipe(bb);
    });
  }

  async json(): Promise<TJSON> {
    const text = await this.text();
    return JSON.parse(text);
  }

  async text(): Promise<string> {
    if (this.bodyType === BodyInitType.String) {
      return this.bodyInit as string;
    }
    const blob = await this.blob();
    return blob.text();
  }
}

function processBodyInit(bodyInit: BodyPonyfillInit | null): {
  bodyType?: BodyInitType;
  contentType: string | null;
  contentLength: number | null;
  body: PonyfillReadableStream<Uint8Array> | null;
} {
  if (bodyInit == null) {
    return {
      body: null,
      contentType: null,
      contentLength: null,
    };
  }
  if (typeof bodyInit === 'string') {
    const buffer = Buffer.from(bodyInit);
    const readable = Readable.from(buffer);
    const body = new PonyfillReadableStream<Uint8Array>(readable);
    return {
      bodyType: BodyInitType.String,
      contentType: 'text/plain;charset=UTF-8',
      contentLength: buffer.length,
      body,
    };
  }
  if (bodyInit instanceof PonyfillReadableStream) {
    return {
      bodyType: BodyInitType.ReadableStream,
      body: bodyInit,
      contentType: null,
      contentLength: null,
    };
  }
  if (bodyInit instanceof PonyfillBlob) {
    const readable = bodyInit.stream();
    const body = new PonyfillReadableStream<Uint8Array>(readable);
    return {
      bodyType: BodyInitType.Blob,
      contentType: bodyInit.type,
      contentLength: bodyInit.size,
      body,
    };
  }
  if (bodyInit instanceof PonyfillFormData) {
    const boundary = Math.random().toString(36).substr(2);
    const contentType = `multipart/form-data; boundary=${boundary}`;
    const body = bodyInit.stream(boundary);
    return {
      bodyType: BodyInitType.FormData,
      contentType,
      contentLength: null,
      body,
    };
  }
  if ('buffer' in bodyInit) {
    const contentLength = bodyInit.byteLength;
    const buffer = Buffer.from(bodyInit.buffer, bodyInit.byteOffset, bodyInit.byteLength);
    const readable = Readable.from(buffer);
    const body = new PonyfillReadableStream<Uint8Array>(readable);
    return {
      contentLength,
      contentType: null,
      body,
    };
  }
  if (bodyInit instanceof ArrayBuffer) {
    const contentLength = bodyInit.byteLength;
    const buffer = Buffer.from(bodyInit, undefined, bodyInit.byteLength);
    const readable = Readable.from(buffer);
    const body = new PonyfillReadableStream<Uint8Array>(readable);
    return {
      bodyType: BodyInitType.ArrayBuffer,
      contentType: null,
      contentLength,
      body,
    };
  }
  if (bodyInit instanceof Readable) {
    const body = new PonyfillReadableStream<Uint8Array>(bodyInit);
    return {
      bodyType: BodyInitType.Readable,
      contentType: null,
      contentLength: null,
      body,
    };
  }
  if ('stream' in bodyInit) {
    const bodyStream = bodyInit.stream();
    const body = new PonyfillReadableStream<Uint8Array>(bodyStream);
    return {
      contentType: bodyInit.type,
      contentLength: bodyInit.size,
      body,
    };
  }
  if (bodyInit instanceof URLSearchParams) {
    const contentType = 'application/x-www-form-urlencoded;charset=UTF-8';
    const body = new PonyfillReadableStream<Uint8Array>(Readable.from(bodyInit.toString()));
    return {
      bodyType: BodyInitType.String,
      contentType,
      contentLength: null,
      body,
    };
  }
  if ('forEach' in bodyInit) {
    const formData = new PonyfillFormData();
    bodyInit.forEach((value, key) => {
      formData.append(key, value);
    });
    const boundary = Math.random().toString(36).substr(2);
    const contentType = `multipart/form-data; boundary=${boundary}`;
    const body = formData.stream(boundary);
    return {
      contentType,
      contentLength: null,
      body,
    };
  }

  throw new Error('Unknown body type');
}
