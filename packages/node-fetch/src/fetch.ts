import { createReadStream } from 'fs';
import { fileURLToPath } from 'url';
import { fetchCurl } from './fetchCurl.js';
import { fetchNodeHttp } from './fetchNodeHttp.js';
import { PonyfillRequest, RequestPonyfillInit } from './Request.js';
import { PonyfillResponse } from './Response.js';
import { PonyfillURL } from './URL.js';
import { fakePromise } from './utils.js';

const BASE64_SUFFIX = ';base64';

function getResponseForFile(url: string) {
  const path = fileURLToPath(url);
  const readable = createReadStream(path);
  return new PonyfillResponse(readable);
}

function getResponseForDataUri(url: string) {
  const [mimeType = 'text/plain', ...datas] = url.substring(5).split(',');
  const data = decodeURIComponent(datas.join(','));
  if (mimeType.endsWith(BASE64_SUFFIX)) {
    const buffer = Buffer.from(data, 'base64url');
    const realMimeType = mimeType.slice(0, -BASE64_SUFFIX.length);
    return new PonyfillResponse(buffer, {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': realMimeType,
      },
    });
  }
  return new PonyfillResponse(data, {
    status: 200,
    statusText: 'OK',
    headers: {
      'content-type': mimeType,
    },
  });
}

function getResponseForBlob(url: string) {
  const blob = PonyfillURL.getBlobFromURL(url);
  if (!blob) {
    throw new TypeError('Invalid Blob URL');
  }
  return new PonyfillResponse(blob, {
    status: 200,
    headers: {
      'content-type': blob.type,
      'content-length': blob.size.toString(),
    },
  });
}

function isURL(obj: any): obj is URL {
  return obj != null && obj.href != null;
}

export function fetchPonyfill<TResponseJSON = any, TRequestJSON = any>(
  info: string | PonyfillRequest<TRequestJSON> | URL,
  init?: RequestPonyfillInit,
): Promise<PonyfillResponse<TResponseJSON>> {
  if (typeof info === 'string' || isURL(info)) {
    const ponyfillRequest = new PonyfillRequest(info, init);
    return fetchPonyfill(ponyfillRequest);
  }
  const fetchRequest = info;
  if (fetchRequest.url.startsWith('data:')) {
    const response = getResponseForDataUri(fetchRequest.url);
    return fakePromise(response);
  }

  if (fetchRequest.url.startsWith('file:')) {
    const response = getResponseForFile(fetchRequest.url);
    return fakePromise(response);
  }
  if (fetchRequest.url.startsWith('blob:')) {
    const response = getResponseForBlob(fetchRequest.url);
    return fakePromise(response);
  }
  if (globalThis.libcurl) {
    return fetchCurl(fetchRequest);
  }
  return fetchNodeHttp(fetchRequest);
}
