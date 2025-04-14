/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Buffer } from 'node:buffer';
import { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import { Busboy, BusboyFileStream } from '@fastify/busboy';
import { handleMaybePromise, MaybePromise } from '@whatwg-node/promise-helpers';
import { hasArrayBufferMethod, hasBufferMethod, hasBytesMethod, PonyfillBlob } from './Blob.js';
import { PonyfillFile } from './File.js';
import { getStreamFromFormData, PonyfillFormData } from './FormData.js';
import { PonyfillReadableStream } from './ReadableStream.js';
import { fakePromise, isArrayBufferView, wrapIncomingMessageWithPassthrough } from './utils.js';

enum BodyInitType {
  ReadableStream = 'ReadableStream',
  Blob = 'Blob',
  FormData = 'FormData',
  String = 'String',
  Readable = 'Readable',
  Buffer = 'Buffer',
  AsyncIterable = 'AsyncIterable',
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
  signal?: AbortSignal;
}

export class PonyfillBody<TJSON = any> implements Body {
  bodyUsed = false;
  contentType: string | null = null;
  contentLength: number | null = null;
  signal?: AbortSignal | null = null;

  constructor(
    private bodyInit: BodyPonyfillInit | null,
    private options: PonyfillBodyOptions = {},
  ) {
    this.signal = options.signal || null;
    const { bodyFactory, contentType, contentLength, bodyType, buffer } = processBodyInit(
      bodyInit,
      options?.signal,
    );
    this._bodyFactory = bodyFactory;
    this.contentType = contentType;
    this.contentLength = contentLength;
    this.bodyType = bodyType;
    this._buffer = buffer;
  }

  private bodyType?: BodyInitType | undefined;

  private _bodyFactory: () => PonyfillReadableStream<Uint8Array> | null = () => null;
  private _generatedBody: PonyfillReadableStream<Uint8Array> | null = null;
  private _buffer?: Buffer | undefined;

  private generateBody(): PonyfillReadableStream<Uint8Array> | null {
    if (this._generatedBody?.readable?.destroyed && this._buffer) {
      this._generatedBody.readable = Readable.from(this._buffer);
    }
    if (this._generatedBody) {
      return this._generatedBody;
    }
    const body = this._bodyFactory();

    this._generatedBody = body;

    return body;
  }

  protected handleContentLengthHeader(this: PonyfillBody & { headers: Headers }, forceSet = false) {
    const contentTypeInHeaders = this.headers.get('content-type');
    if (!contentTypeInHeaders) {
      if (this.contentType) {
        this.headers.set('content-type', this.contentType);
      }
    } else {
      this.contentType = contentTypeInHeaders;
    }

    const contentLengthInHeaders = this.headers.get('content-length');

    if (forceSet && this.bodyInit == null && !contentLengthInHeaders) {
      this.contentLength = 0;
      this.headers.set('content-length', '0');
    }

    if (!contentLengthInHeaders) {
      if (this.contentLength) {
        this.headers.set('content-length', this.contentLength.toString());
      }
    } else {
      this.contentLength = parseInt(contentLengthInHeaders, 10);
    }
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

  _chunks: MaybePromise<Uint8Array[]> | null = null;

  _doCollectChunksFromReadableJob() {
    if (this.bodyType === BodyInitType.AsyncIterable) {
      if (Array.fromAsync) {
        return handleMaybePromise(
          () => Array.fromAsync(this.bodyInit as AsyncIterable<Uint8Array>),
          chunks => {
            this._chunks = chunks;
            return this._chunks;
          },
        );
      }
      const iterator = (this.bodyInit as AsyncIterable<Uint8Array>)[Symbol.asyncIterator]();
      const chunks: Uint8Array[] = [];
      const collectValue = (): MaybePromise<Uint8Array[]> =>
        handleMaybePromise(
          () => iterator.next(),
          ({ value, done }) => {
            if (value) {
              chunks.push(value);
            }
            if (!done) {
              return collectValue();
            }
            this._chunks = chunks;
            return this._chunks;
          },
        );
      return collectValue();
    }
    const _body = this.generateBody();
    if (!_body) {
      this._chunks = [];
      return fakePromise(this._chunks);
    }
    return _body.readable.toArray().then(chunks => {
      this._chunks = chunks;
      return this._chunks;
    });
  }

  _collectChunksFromReadable() {
    if (this._chunks) {
      return fakePromise(this._chunks);
    }
    this._chunks ||= this._doCollectChunksFromReadableJob();
    return this._chunks;
  }

  _blob: PonyfillBlob | null = null;

  blob(): Promise<PonyfillBlob> {
    if (this._blob) {
      return fakePromise(this._blob);
    }
    if (this.bodyType === BodyInitType.Blob) {
      this._blob = this.bodyInit as PonyfillBlob;
      return fakePromise(this._blob);
    }
    if (this._buffer) {
      this._blob = new PonyfillBlob([this._buffer], {
        type: this.contentType || '',
        size: this.contentLength,
      });
      return fakePromise(this._blob);
    }
    return fakePromise(
      handleMaybePromise(
        () => this._collectChunksFromReadable(),
        chunks => {
          this._blob = new PonyfillBlob(chunks, {
            type: this.contentType || '',
            size: this.contentLength,
          });
          return this._blob;
        },
      ),
    );
  }

  _formData: PonyfillFormData | null = null;

  formData(opts?: { formDataLimits: FormDataLimits }): Promise<PonyfillFormData> {
    if (this._formData) {
      return fakePromise(this._formData);
    }
    if (this.bodyType === BodyInitType.FormData) {
      this._formData = this.bodyInit as PonyfillFormData;
      return fakePromise(this._formData);
    }
    this._formData = new PonyfillFormData();
    const _body = this.generateBody();
    if (_body == null) {
      return fakePromise(this._formData);
    }
    const formDataLimits = {
      ...this.options.formDataLimits,
      ...opts?.formDataLimits,
    };
    return new Promise((resolve, reject) => {
      const stream = this.body?.readable;
      if (!stream) {
        return reject(new Error('No stream available'));
      }

      let lastError;

      // form data file that is currently being processed, it's
      // important to keep track of it in case the stream ends early
      let currFile: BusboyFileStream | null = null;

      const bb = new Busboy({
        headers: {
          'content-length':
            typeof this.contentLength === 'number'
              ? this.contentLength.toString()
              : this.contentLength || '',
          'content-type': this.contentType || '',
        },
        limits: formDataLimits,
        defCharset: 'utf-8',
      });

      const complete = (err: unknown) => {
        stream!.unpipe(bb);
        bb.destroy();
        if (currFile) {
          currFile.destroy();
          currFile = null;
        }
        if (err || lastError) {
          reject(err || lastError);
        } else {
          // no error occured, this is a successful end/complete/finish
          resolve(this._formData!);
        }
      };

      // we dont need to listen to the stream close event because bb will close or error when necessary
      // stream.on('close', complete);

      // stream can be aborted, for example
      stream.on('error', complete);

      bb.on('field', (name, value, fieldnameTruncated, valueTruncated) => {
        if (fieldnameTruncated) {
          return complete(
            new Error(`Field name size exceeded: ${formDataLimits?.fieldNameSize} bytes`),
          );
        }
        if (valueTruncated) {
          return complete(
            new Error(`Field value size exceeded: ${formDataLimits?.fieldSize} bytes`),
          );
        }
        this._formData!.set(name, value);
      });

      bb.on('file', (name, fileStream, filename, _transferEncoding, mimeType) => {
        currFile = fileStream;
        const chunks: BlobPart[] = [];
        fileStream.on('data', chunk => {
          chunks.push(chunk);
        });
        fileStream.on('error', complete);
        fileStream.on('limit', () => {
          complete(new Error(`File size limit exceeded: ${formDataLimits?.fileSize} bytes`));
        });
        fileStream.on('close', () => {
          if (fileStream.truncated) {
            complete(new Error(`File size limit exceeded: ${formDataLimits?.fileSize} bytes`));
          }
          currFile = null;
          const file = new PonyfillFile(chunks, filename, { type: mimeType });
          this._formData!.set(name, file);
        });
      });

      bb.on('fieldsLimit', () => {
        complete(new Error(`Fields limit exceeded: ${formDataLimits?.fields}`));
      });
      bb.on('filesLimit', () => {
        complete(new Error(`Files limit exceeded: ${formDataLimits?.files}`));
      });
      bb.on('partsLimit', () => {
        complete(new Error(`Parts limit exceeded: ${formDataLimits?.parts}`));
      });
      bb.on('end', complete);
      bb.on('finish', complete);
      bb.on('close', complete);
      bb.on('error', complete);

      stream.pipe(bb);
    });
  }

  buffer(): Promise<Buffer> {
    if (this._buffer) {
      return fakePromise(this._buffer);
    }
    if (this.bodyType === BodyInitType.Blob) {
      if (hasBufferMethod(this.bodyInit)) {
        return this.bodyInit.buffer().then(buf => {
          this._buffer = buf;
          return this._buffer;
        });
      }
      if (hasBytesMethod(this.bodyInit)) {
        return this.bodyInit.bytes().then(bytes => {
          this._buffer = Buffer.from(bytes);
          return this._buffer;
        });
      }
      if (hasArrayBufferMethod(this.bodyInit)) {
        return this.bodyInit.arrayBuffer().then(buf => {
          this._buffer = Buffer.from(buf, undefined, buf.byteLength);
          return this._buffer;
        });
      }
    }
    return fakePromise(
      handleMaybePromise(
        () => this._collectChunksFromReadable(),
        chunks => {
          if (chunks.length === 1) {
            this._buffer = chunks[0] as Buffer;
            return this._buffer;
          }
          this._buffer = Buffer.concat(chunks);
          return this._buffer;
        },
      ),
    );
  }

  bytes(): Promise<Uint8Array> {
    return this.buffer();
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    // @ts-ignore - Mismatch between Buffer and ArrayBuffer
    return this.buffer();
  }

  _json: TJSON | null = null;

  json(): Promise<TJSON> {
    if (this._json) {
      return fakePromise(this._json);
    }
    return this.text().then(text => {
      try {
        this._json = JSON.parse(text);
      } catch (e) {
        if (e instanceof SyntaxError) {
          e.message += `, "${text}" is not valid JSON`;
        }
        throw e;
      }
      return this._json!;
    });
  }

  _text: string | null = null;

  text(): Promise<string> {
    if (this._text) {
      return fakePromise(this._text);
    }
    if (this.bodyType === BodyInitType.String) {
      this._text = this.bodyInit as string;
      return fakePromise(this._text);
    }
    return this.buffer().then(buffer => {
      this._text = buffer.toString('utf-8');
      return this._text;
    });
  }
}

function processBodyInit(
  bodyInit: BodyPonyfillInit | null,
  signal?: AbortSignal,
): {
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
    const buffer: Buffer = bodyInit;
    return {
      bodyType: BodyInitType.Buffer,
      contentType: null,
      contentLength: bodyInit.length,
      buffer: bodyInit,
      bodyFactory() {
        const readable = Readable.from(buffer);
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
    const readableStream: PonyfillReadableStream<Uint8Array> = bodyInit;
    return {
      bodyType: BodyInitType.ReadableStream,
      bodyFactory: () => readableStream,
      contentType: null,
      contentLength: null,
    };
  }
  if (isBlob(bodyInit)) {
    const blob = bodyInit as PonyfillBlob;
    return {
      bodyType: BodyInitType.Blob,
      contentType: bodyInit.type,
      contentLength: bodyInit.size,
      bodyFactory() {
        return blob.stream();
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
  if (bodyInit instanceof IncomingMessage) {
    const passThrough = wrapIncomingMessageWithPassthrough({
      incomingMessage: bodyInit,
      signal,
    });
    return {
      bodyType: BodyInitType.Readable,
      contentType: null,
      contentLength: null,
      bodyFactory() {
        return new PonyfillReadableStream<Uint8Array>(passThrough);
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

  if (isReadableStream(bodyInit)) {
    return {
      contentType: null,
      contentLength: null,
      bodyFactory() {
        return new PonyfillReadableStream(bodyInit);
      },
    };
  }

  if ((bodyInit as any)[Symbol.iterator] || (bodyInit as any)[Symbol.asyncIterator]) {
    return {
      contentType: null,
      contentLength: null,
      bodyType: BodyInitType.AsyncIterable,
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
  return value?.stream != null && typeof value.stream === 'function';
}

function isURLSearchParams(value: any): value is URLSearchParams {
  return value?.sort != null;
}

function isReadableStream(value: any): value is ReadableStream {
  return value?.getReader != null;
}
