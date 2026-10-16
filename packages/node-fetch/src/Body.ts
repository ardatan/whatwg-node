/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Buffer } from 'node:buffer';
import { addAbortSignal, Readable, Transform } from 'node:stream';
import { Busboy, BusboyFileStream } from '@fastify/busboy';
import { fakeRejectPromise, handleMaybePromise, MaybePromise } from '@whatwg-node/promise-helpers';
import { hasArrayBufferMethod, hasBufferMethod, hasBytesMethod, PonyfillBlob } from './Blob.js';
import { ContentLengthMismatchError } from './ContentLengthMismatchError.js';
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
  signal?: AbortSignal | undefined;
}

export class PonyfillBody<TJSON = any> implements Body {
  bodyUsed = false;
  contentType: string | null = null;
  contentLength: number | null = null;
  /**
   * When true, body reads enforce that the byte count matches `contentLength`
   * (taken from a caller-supplied `Content-Length` header). Excess data fails
   * as soon as it is observed.
   */
  private _enforceContentLength = false;

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
    this._signal = options.signal;
  }

  private bodyType?: BodyInitType | undefined;

  private _bodyFactory: () => PonyfillReadableStream<Uint8Array> | null = () => null;
  private _generatedBody: PonyfillReadableStream<Uint8Array> | null = null;
  private _buffer?: Buffer<ArrayBuffer> | undefined;
  _signal?: AbortSignal | undefined;

  private shouldEnforceContentLength(): boolean {
    return this._enforceContentLength && Number.isFinite(this.contentLength);
  }

  private assertExactContentLength(byteLength: number): void {
    if (!this.shouldEnforceContentLength()) {
      return;
    }
    if (byteLength !== this.contentLength) {
      throw new ContentLengthMismatchError();
    }
  }

  private rejectedContentLengthMismatch(byteLength: number): Promise<never> | null {
    try {
      this.assertExactContentLength(byteLength);
      return null;
    } catch (err) {
      return fakeRejectPromise(err);
    }
  }

  private generateBody(): PonyfillReadableStream<Uint8Array> | null {
    if (this._generatedBody?.readable?.destroyed && this._buffer) {
      this._generatedBody.readable = Readable.from(this._buffer);
    }
    if (this._generatedBody) {
      return this._generatedBody;
    }
    let body = this._bodyFactory();

    if (body != null && this.shouldEnforceContentLength()) {
      body = wrapReadableWithContentLengthCheck(body, this.contentLength!);
    }

    this._generatedBody = body;

    return body;
  }

  protected handleContentLengthHeader(
    this: PonyfillBody & { headers: Headers },
    forceSet = false,
    /**
     * When true (Request), body reads must match a caller-supplied Content-Length.
     * Response keeps this false — response bodies are often streamed without a
     * trustworthy length, and synthetic error responses may carry Content-Length: 0.
     */
    enforceFromHeader = false,
  ) {
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
      // Only enforce on Request when the header was supplied by the caller
      // (client / adapter), not when we derived Content-Length from a known-size body init.
      if (enforceFromHeader) {
        this._enforceContentLength = true;
      }
    }
  }

  public get body(): PonyfillReadableStream<Uint8Array<ArrayBuffer>> | null {
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

  _chunks: MaybePromise<Uint8Array<ArrayBuffer>[]> | null = null;

  _doCollectChunksFromReadableJob() {
    if (this.bodyType === BodyInitType.AsyncIterable) {
      // Route through generateBody so Content-Length enforcement wraps the stream.
      if (this.shouldEnforceContentLength()) {
        // fall through to the stream collector below
      } else if (Array.fromAsync) {
        return handleMaybePromise(
          () => Array.fromAsync(this.bodyInit as AsyncIterable<Uint8Array<ArrayBuffer>>),
          chunks => {
            this._chunks = chunks;
            return this._chunks;
          },
        );
      } else {
        const iterator = (this.bodyInit as AsyncIterable<Uint8Array<ArrayBuffer>>)[
          Symbol.asyncIterator
        ]();
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        const collectValue = (): MaybePromise<Uint8Array<ArrayBuffer>[]> =>
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
    }
    const _body = this.generateBody();
    if (!_body) {
      const rejected = this.rejectedContentLengthMismatch(0);
      if (rejected) {
        return rejected;
      }
      this._chunks = [];
      return fakePromise(this._chunks);
    }
    if (_body.readable.destroyed) {
      const rejected = this.rejectedContentLengthMismatch(0);
      if (rejected) {
        return rejected;
      }
      return fakePromise((this._chunks = []));
    }
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    return new Promise<Uint8Array<ArrayBuffer>[]>((resolve, reject) => {
      _body.readable.on('data', chunk => {
        chunks.push(chunk);
      });
      _body.readable.once('error', reject);
      _body.readable.once('end', () => {
        resolve((this._chunks = chunks));
      });
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
    if (this.bodyType === BodyInitType.String) {
      this._text = this.bodyInit as string;
      const rejected = this.rejectedContentLengthMismatch(Buffer.byteLength(this._text));
      if (rejected) {
        return rejected;
      }
      this._blob = new PonyfillBlob([this._text], {
        type: this.contentType || 'text/plain;charset=UTF-8',
        size: this.contentLength,
      });
      return fakePromise(this._blob);
    }
    if (this.bodyType === BodyInitType.Blob) {
      this._blob = this.bodyInit as PonyfillBlob;
      const rejected = this.rejectedContentLengthMismatch(this._blob.size);
      if (rejected) {
        return rejected;
      }
      return fakePromise(this._blob);
    }
    if (this._buffer) {
      const rejected = this.rejectedContentLengthMismatch(this._buffer.byteLength);
      if (rejected) {
        return rejected;
      }
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

      if (this._signal) {
        addAbortSignal(this._signal, bb);
      }

      let completed = false;
      const complete = (err: unknown) => {
        if (completed) return;
        completed = true;
        stream!.unpipe(bb);
        bb.destroy();
        if (currFile) {
          currFile.destroy();
          currFile = null;
        }
        if (err) {
          reject(err);
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

  buffer(): Promise<Buffer<ArrayBuffer>> {
    if (this._buffer) {
      const rejected = this.rejectedContentLengthMismatch(this._buffer.byteLength);
      if (rejected) {
        return rejected;
      }
      return fakePromise(this._buffer);
    }
    if (this._text) {
      this._buffer = Buffer.from(this._text, 'utf-8');
      const rejected = this.rejectedContentLengthMismatch(this._buffer.byteLength);
      if (rejected) {
        return rejected;
      }
      return fakePromise(this._buffer);
    }
    if (this.bodyType === BodyInitType.String) {
      return this.text().then(text => {
        this._text = text;
        this._buffer = Buffer.from(text, 'utf-8');
        return this._buffer;
      });
    }
    if (this.bodyType === BodyInitType.Blob && !this.shouldEnforceContentLength()) {
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
            this._buffer = chunks[0] as Buffer<ArrayBuffer>;
            return this._buffer;
          }
          this._buffer = Buffer.concat(chunks);
          return this._buffer;
        },
      ),
    );
  }

  bytes(): Promise<Uint8Array<ArrayBuffer>> {
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
      const rejected = this.rejectedContentLengthMismatch(Buffer.byteLength(this._text));
      if (rejected) {
        return rejected;
      }
      return fakePromise(this._text);
    }
    return this.buffer().then(buffer => {
      this._text = buffer.toString('utf-8');
      return this._text;
    });
  }
}

/**
 * Counts bytes while reading and rejects as soon as the stream would deliver
 * more than `contentLength`. Ending with fewer bytes is also a mismatch.
 */
function wrapReadableWithContentLengthCheck(
  body: PonyfillReadableStream<Uint8Array>,
  contentLength: number,
): PonyfillReadableStream<Uint8Array> {
  let bytesRead = 0;
  const transform = new Transform({
    transform(chunk, _encoding, callback) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (bytesRead + buf.byteLength > contentLength) {
        callback(new ContentLengthMismatchError());
        return;
      }
      bytesRead += buf.byteLength;
      callback(null, buf);
    },
    flush(callback) {
      if (bytesRead !== contentLength) {
        callback(new ContentLengthMismatchError());
        return;
      }
      callback();
    },
  });
  body.readable.pipe(transform);
  body.readable.on('error', (err: Error) => {
    transform.destroy(err);
  });
  return new PonyfillReadableStream<Uint8Array>(transform);
}

function processBodyInit(bodyInit: BodyPonyfillInit | null): {
  bodyType?: BodyInitType;
  contentType: string | null;
  contentLength: number | null;
  buffer?: Buffer<ArrayBuffer>;
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
    const contentLength = Buffer.byteLength(bodyInit);
    return {
      bodyType: BodyInitType.String,
      contentType: 'text/plain;charset=UTF-8',
      contentLength,
      bodyFactory() {
        const readable = Readable.from(
          Buffer.from(bodyInit, 'utf-8'), // Convert string to Buffer
        );
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
      buffer: bodyInit as Buffer<ArrayBuffer>,
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
    const boundary = createFormDataBoundary();
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

const FORM_DATA_BOUNDARY_LENGTH = 16;

function createFormDataBoundary(): string {
  // A fixed length keeps a resent FormData body the same size, so Content-Length stays valid.
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  let boundary = '';
  for (let i = 0; i < FORM_DATA_BOUNDARY_LENGTH; i++) {
    boundary += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return boundary;
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
