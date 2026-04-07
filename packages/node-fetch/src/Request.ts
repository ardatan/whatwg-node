import { Agent as HTTPAgent } from 'node:http';
import { Agent as HTTPSAgent } from 'node:https';
import { BodyPonyfillInit, PonyfillBody, PonyfillBodyOptions } from './Body.js';
import { isHeadersLike, PonyfillHeaders, PonyfillHeadersInit } from './Headers.js';
import { PonyfillURL } from './URL.js';

function isRequest(input: any): input is PonyfillRequest {
  return input[Symbol.toStringTag] === 'Request';
}

export type RequestPonyfillInit = PonyfillBodyOptions &
  Omit<RequestInit, 'body' | 'headers'> & {
    body?: BodyPonyfillInit | null | undefined;
    duplex?: 'half' | 'full' | undefined;
    headers?: PonyfillHeadersInit | undefined;
    headersSerializer?: HeadersSerializer | undefined;
    agent?: HTTPAgent | HTTPSAgent | false | undefined;
  };

type HeadersSerializer = (
  headers: Headers,
  onContentLength?: (contentLength: string) => void,
) => string[];

function isURL(obj: any): obj is URL {
  return obj?.href != null;
}

export class PonyfillRequest<TJSON = any> extends PonyfillBody<TJSON> implements Request {
  constructor(input: RequestInfo | URL, options?: RequestPonyfillInit) {
    let _url: string | undefined;
    let _parsedUrl: URL | undefined;
    let bodyInit: BodyPonyfillInit | null = null;
    let requestInit: RequestPonyfillInit | undefined;

    if (typeof input === 'string') {
      _url = input;
    } else if (isURL(input)) {
      _parsedUrl = input;
    } else if (isRequest(input)) {
      return input;
    }

    if (options != null) {
      bodyInit = options.body || null;
      requestInit = options;
    }

    super(bodyInit, requestInit);

    this._url = _url;
    this._parsedUrl = _parsedUrl;

    this.cache = requestInit?.cache || 'default';
    this.credentials = requestInit?.credentials || 'same-origin';
    this.headers =
      requestInit?.headers && isHeadersLike(requestInit.headers)
        ? requestInit.headers
        : new PonyfillHeaders(requestInit?.headers);
    this.integrity = requestInit?.integrity || '';
    this.keepalive = requestInit?.keepalive != null ? requestInit?.keepalive : false;

    this.method = requestInit?.method?.toUpperCase() || 'GET';
    this.mode = requestInit?.mode || 'cors';
    this.redirect = requestInit?.redirect || 'follow';
    this.referrer = requestInit?.referrer || 'about:client';
    this.referrerPolicy = requestInit?.referrerPolicy || 'no-referrer';
    this.headersSerializer = requestInit?.headersSerializer;
    this.duplex = requestInit?.duplex || 'half';

    this.destination = 'document';
    this.priority = 'auto';

    if (this.method !== 'GET' && this.method !== 'HEAD') {
      this.handleContentLengthHeader(true);
    }

    if (requestInit?.agent != null) {
      const protocol = _parsedUrl?.protocol || _url || this.url;
      if (requestInit.agent === false) {
        this.agent = false;
      } else if (protocol.startsWith('http:') && requestInit.agent instanceof HTTPAgent) {
        this.agent = requestInit.agent;
      } else if (protocol.startsWith('https:') && requestInit.agent instanceof HTTPSAgent) {
        this.agent = requestInit.agent;
      }
    }
  }

  headersSerializer?: HeadersSerializer | undefined;
  // @ts-expect-error - It is initialized
  cache: RequestCache;
  // @ts-expect-error - It is initialized
  credentials: RequestCredentials;
  // @ts-expect-error - It is initialized
  destination: RequestDestination;
  // @ts-expect-error - It is initialized
  headers: Headers;
  // @ts-expect-error - It is initialized
  integrity: string;
  // @ts-expect-error - It is initialized
  keepalive: boolean;
  // @ts-expect-error - It is initialized
  method: string;
  // @ts-expect-error - It is initialized
  mode: RequestMode;
  // @ts-expect-error - It is initialized
  priority: 'auto' | 'high' | 'low';
  // @ts-expect-error - It is initialized
  redirect: RequestRedirect;
  // @ts-expect-error - It is initialized
  referrer: string;
  // @ts-expect-error - It is initialized
  referrerPolicy: ReferrerPolicy;
  _url: string | undefined;

  get signal(): AbortSignal {
    this._signal ||= new AbortController().signal;
    return this._signal;
  }

  get url(): string {
    if (this._url == null) {
      if (this._parsedUrl) {
        this._url = this._parsedUrl.toString();
      } else {
        throw new TypeError('Invalid URL');
      }
    }
    return this._url;
  }

  _parsedUrl: URL | undefined;
  get parsedUrl(): URL {
    if (this._parsedUrl == null) {
      if (this._url != null) {
        this._parsedUrl = new PonyfillURL(this._url, 'http://localhost');
      } else {
        throw new TypeError('Invalid URL');
      }
    }
    return this._parsedUrl;
  }

  duplex: 'half' | 'full' = 'half';

  agent: HTTPAgent | HTTPSAgent | false | undefined;

  clone(): PonyfillRequest<TJSON> {
    return this;
  }

  [Symbol.toStringTag] = 'Request';
}
