import { Agent as HTTPAgent } from 'http';
import { Agent as HTTPSAgent } from 'https';
import { BodyPonyfillInit, PonyfillBody, PonyfillBodyOptions } from './Body.js';
import { isHeadersLike, PonyfillHeaders, PonyfillHeadersInit } from './Headers.js';

function isRequest(input: any): input is PonyfillRequest {
  return input[Symbol.toStringTag] === 'Request';
}

export type RequestPonyfillInit = PonyfillBodyOptions &
  Omit<RequestInit, 'body' | 'headers'> & {
    body?: BodyPonyfillInit | null;
    duplex?: 'half' | 'full';
    headers?: PonyfillHeadersInit;
    headersSerializer?: HeadersSerializer;
    agent?: HTTPAgent | HTTPSAgent | false;
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
    let url: string | undefined;
    let bodyInit: BodyPonyfillInit | null = null;
    let requestInit: RequestPonyfillInit | undefined;

    if (typeof input === 'string') {
      url = input;
    } else if (isURL(input)) {
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
    this._signal = requestInit?.signal;
    this.headersSerializer = requestInit?.headersSerializer;
    this.duplex = requestInit?.duplex || 'half';

    this.url = url || '';

    this.destination = 'document';
    this.priority = 'auto';

    if (this.method !== 'GET' && this.method !== 'HEAD') {
      this.handleContentLengthHeader(true);
    }

    if (requestInit?.agent != null) {
      if (requestInit.agent === false) {
        this.agent = false;
      } else if (this.url.startsWith('http:/') && requestInit.agent instanceof HTTPAgent) {
        this.agent = requestInit.agent;
      } else if (this.url.startsWith('https:/') && requestInit.agent instanceof HTTPSAgent) {
        this.agent = requestInit.agent;
      }
    }
  }

  headersSerializer?: HeadersSerializer;
  cache: RequestCache;
  credentials: RequestCredentials;
  destination: RequestDestination;
  headers: Headers;
  integrity: string;
  keepalive: boolean;
  method: string;
  mode: RequestMode;
  priority: 'auto' | 'high' | 'low';
  redirect: RequestRedirect;
  referrer: string;
  referrerPolicy: ReferrerPolicy;
  url: string;
  duplex: 'half' | 'full';

  agent: HTTPAgent | HTTPSAgent | false | undefined;

  private _signal: AbortSignal | undefined | null;

  get signal() {
    // Create a new signal only if needed
    // Because the creation of signal is expensive
    if (!this._signal) {
      this._signal = new AbortController().signal;
    }
    return this._signal!;
  }

  clone(): PonyfillRequest<TJSON> {
    return this;
  }

  [Symbol.toStringTag] = 'Request';
}
