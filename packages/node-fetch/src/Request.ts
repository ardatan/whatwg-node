import { PonyfillAbortController } from './AbortController';
import { PonyfillBody, BodyPonyfillInit, PonyfillBodyOptions } from './Body';
import { PonyfillHeaders, PonyfillHeadersInit } from './Headers';

function isRequest(input: any): input is PonyfillRequest {
  return input[Symbol.toStringTag] === 'Request';
}

export type RequestPonyfillInit = PonyfillBodyOptions &
  Omit<RequestInit, 'body' | 'headers'> & {
    body?: BodyPonyfillInit | null;
    headers?: PonyfillHeadersInit;
  };

export class PonyfillRequest<TJSON = any> extends PonyfillBody<TJSON> implements Request {
  constructor(input: RequestInfo | URL, options?: RequestPonyfillInit) {
    let url: string | undefined;
    let bodyInit: BodyPonyfillInit | null = null;
    let requestInit: RequestPonyfillInit | undefined;

    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (isRequest(input)) {
      url = input.url;
      bodyInit = input.body;
      requestInit = input;
    }

    if (options != null) {
      bodyInit = options.body || null;
      requestInit = options;
    }

    super(bodyInit, options);

    this.cache = requestInit?.cache || 'default';
    this.credentials = requestInit?.credentials || 'same-origin';
    this.headers = new PonyfillHeaders(requestInit?.headers);
    this.integrity = requestInit?.integrity || '';
    this.keepalive = requestInit?.keepalive || true;
    this.method = requestInit?.method?.toUpperCase() || 'GET';
    this.mode = requestInit?.mode || 'cors';
    this.redirect = requestInit?.redirect || 'follow';
    this.referrer = requestInit?.referrer || 'about:client';
    this.referrerPolicy = requestInit?.referrerPolicy || 'no-referrer';
    this.signal = requestInit?.signal || new PonyfillAbortController().signal;

    this.url = url || '';

    if (this.keepalive) {
      if (!this.headers.has('connection')) {
        this.headers.set('connection', 'keep-alive');
      }
    }

    const contentTypeInHeaders = this.headers.get('content-type');
    if (!contentTypeInHeaders) {
      if (this.contentType) {
        this.headers.set('content-type', this.contentType);
      }
    } else {
      this.contentType = contentTypeInHeaders;
    }

    const contentLengthInHeaders = this.headers.get('content-length');
    if (!contentLengthInHeaders) {
      if (this.contentLength) {
        this.headers.set('content-length', this.contentLength.toString());
      }
    } else {
      this.contentLength = parseInt(contentLengthInHeaders, 10);
    }
  }

  cache: RequestCache;
  credentials: RequestCredentials;
  destination: RequestDestination = '';
  headers: Headers;
  integrity: string;
  keepalive: boolean;
  method: string;
  mode: RequestMode;
  priority = 'auto';
  redirect: RequestRedirect;
  referrer: string;
  referrerPolicy: ReferrerPolicy;
  url: string;
  signal: AbortSignal;

  clone(): Request {
    return new Request(this);
  }
}
