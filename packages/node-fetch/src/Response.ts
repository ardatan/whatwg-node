import { STATUS_CODES } from 'http';
import { BodyPonyfillInit, PonyfillBody, PonyfillBodyOptions } from './Body';
import { PonyfillHeaders, PonyfillHeadersInit } from './Headers';

export type ResponsePonyfilInit = PonyfillBodyOptions &
  Omit<ResponseInit, 'headers'> & {
    url?: string;
    redirected?: boolean;
    headers?: PonyfillHeadersInit;
    type?: ResponseType;
  };

export class PonyfillResponse<TJSON = any> extends PonyfillBody<TJSON> implements Response {
  constructor(body?: BodyPonyfillInit | null, init?: ResponsePonyfilInit) {
    super(body || null, init);
    if (init) {
      this.headers = new PonyfillHeaders(init.headers);
      this.status = init.status || 200;
      this.statusText = init.statusText || STATUS_CODES[this.status] || 'OK';
      this.url = init.url || '';
      this.redirected = init.redirected || false;
      this.type = init.type || 'default';
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

  headers: Headers = new PonyfillHeaders();

  get ok() {
    return this.status >= 200 && this.status < 300;
  }

  status = 200;
  statusText = 'OK';
  url = '';
  redirected = false;

  type: ResponseType = 'default';

  clone() {
    return new PonyfillResponse(this.body, this);
  }

  static error() {
    return new PonyfillResponse(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }

  static redirect(url: string, status = 301) {
    if (status < 300 || status > 399) {
      throw new RangeError('Invalid status code');
    }
    return new PonyfillResponse(null, {
      headers: {
        location: url,
      },
      status,
    });
  }

  static json<T = any>(data: T, init: RequestInit = {}) {
    return new PonyfillResponse<T>(JSON.stringify(data), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  }
}
