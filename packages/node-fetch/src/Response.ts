import { STATUS_CODES } from 'node:http';
import { BodyPonyfillInit, PonyfillBody, PonyfillBodyOptions } from './Body.js';
import { isHeadersLike, PonyfillHeaders, PonyfillHeadersInit } from './Headers.js';

export type ResponsePonyfilInit = PonyfillBodyOptions &
  Omit<ResponseInit, 'headers'> & {
    url?: string | undefined;
    redirected?: boolean | undefined;
    headers?: PonyfillHeadersInit | undefined;
    type?: ResponseType | undefined;
  };

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';

export class PonyfillResponse<TJSON = any> extends PonyfillBody<TJSON> implements Response {
  headers: Headers;

  constructor(body?: BodyPonyfillInit | null | undefined, init?: ResponsePonyfilInit) {
    super(body || null, init);
    this.headers =
      init?.headers && isHeadersLike(init.headers)
        ? init.headers
        : new PonyfillHeaders(init?.headers);
    this.status = init?.status || 200;
    this.statusText = init?.statusText || STATUS_CODES[this.status] || 'OK';
    this.url = init?.url || '';
    this.redirected = init?.redirected || false;
    this.type = init?.type || 'default';

    this.handleContentLengthHeader();
  }

  get ok() {
    return this.status >= 200 && this.status < 300;
  }

  status: number;
  statusText: string;
  url: string;
  redirected: boolean;

  type: ResponseType;

  clone() {
    return this;
  }

  static error() {
    return new PonyfillResponse(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }

  static redirect(url: string, status = 302) {
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

  static json<T = any>(data: T, init?: ResponsePonyfilInit) {
    const bodyInit = JSON.stringify(data);
    if (!init) {
      init = {
        headers: {
          'content-type': JSON_CONTENT_TYPE,
          'content-length': Buffer.byteLength(bodyInit).toString(),
        },
      };
    } else if (!init.headers) {
      init.headers = {
        'content-type': JSON_CONTENT_TYPE,
        'content-length': Buffer.byteLength(bodyInit).toString(),
      };
    } else if (isHeadersLike(init.headers)) {
      if (!init.headers.has('content-type')) {
        init.headers.set('content-type', JSON_CONTENT_TYPE);
      }
      if (!init.headers.has('content-length')) {
        init.headers.set('content-length', Buffer.byteLength(bodyInit).toString());
      }
    } else if (Array.isArray(init.headers)) {
      let contentTypeExists = false;
      let contentLengthExists = false;
      for (const [key] of init.headers) {
        if (contentLengthExists && contentTypeExists) {
          break;
        }
        if (!contentTypeExists && key.toLowerCase() === 'content-type') {
          contentTypeExists = true;
        } else if (!contentLengthExists && key.toLowerCase() === 'content-length') {
          contentLengthExists = true;
        }
      }
      if (!contentTypeExists) {
        init.headers.push(['content-type', JSON_CONTENT_TYPE]);
      }
      if (!contentLengthExists) {
        init.headers.push(['content-length', Buffer.byteLength(bodyInit).toString()]);
      }
    } else if (typeof init.headers === 'object') {
      if (init.headers?.['content-type'] == null) {
        init.headers['content-type'] = JSON_CONTENT_TYPE;
      }
      if (init.headers?.['content-length'] == null) {
        init.headers['content-length'] = Buffer.byteLength(bodyInit).toString();
      }
    }
    return new PonyfillResponse<T>(bodyInit, init);
  }

  [Symbol.toStringTag] = 'Response';
}
