import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import { createBrotliDecompress, createGunzip, createInflate } from 'zlib';
import { request } from 'undici';
import { PonyfillBlob } from './Blob.js';
import { PonyfillRequest, RequestPonyfillInit } from './Request.js';
import { PonyfillResponse } from './Response.js';
import { PonyfillURL } from './URL.js';
import { getHeadersObj } from './utils.js';

function getResponseForFile(url: string) {
  const path = fileURLToPath(url);
  const readable = createReadStream(path);
  return new PonyfillResponse(readable);
}

function getResponseForDataUri(url: URL) {
  const [mimeType = 'text/plain', ...datas] = url.pathname.split(',');
  const data = decodeURIComponent(datas.join(','));
  if (mimeType.endsWith(BASE64_SUFFIX)) {
    const buffer = Buffer.from(data, 'base64url');
    const realMimeType = mimeType.slice(0, -BASE64_SUFFIX.length);
    const file = new PonyfillBlob([buffer], { type: realMimeType });
    return new PonyfillResponse(file, {
      status: 200,
      statusText: 'OK',
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

const BASE64_SUFFIX = ';base64';

export async function fetchPonyfill<TResponseJSON = any, TRequestJSON = any>(
  info: string | PonyfillRequest<TRequestJSON> | URL,
  init?: RequestPonyfillInit,
): Promise<PonyfillResponse<TResponseJSON>> {
  if (typeof info === 'string' || 'href' in info) {
    const ponyfillRequest = new PonyfillRequest(info, init);
    return fetchPonyfill(ponyfillRequest);
  }

  const fetchRequest = info;

  const url = new PonyfillURL(fetchRequest.url, 'http://localhost');

  if (url.protocol === 'data:') {
    const response = getResponseForDataUri(url);
    return response;
  }

  if (url.protocol === 'file:') {
    const response = getResponseForFile(fetchRequest.url);
    return response;
  }

  const requestBody = (
    fetchRequest['bodyInit'] != null
      ? fetchRequest['bodyInit'] :
    fetchRequest.body != null
      ? 'pipe' in fetchRequest.body
        ? fetchRequest.body
        : Readable.from(fetchRequest.body)
      : null
  ) as Readable | null;

  const headersSerializer = fetchRequest.headersSerializer || getHeadersObj;
  const nodeHeaders = headersSerializer(fetchRequest.headers);
  const undiciData = await request(fetchRequest.url, {
    method: fetchRequest.method as any,
    headers: nodeHeaders,
    body: requestBody,
    signal: fetchRequest.signal,
    maxRedirections: fetchRequest.redirect === 'follow' ? 20 : 0,
  });

  if (fetchRequest.redirect === 'error' && undiciData.headers.location) {
    const redirectError = new Error('Redirects are not allowed');
    throw redirectError;
  }

  let responseBody: Readable = undiciData.body;
  const contentEncoding = undiciData.headers['content-encoding'];
  switch (contentEncoding) {
    case 'x-gzip':
    case 'gzip':
      responseBody = responseBody.pipe(createGunzip());
      break;
    case 'x-deflate':
    case 'deflate':
      responseBody = responseBody.pipe(createInflate());
      break;
    case 'br':
      responseBody = responseBody.pipe(createBrotliDecompress());
      break;
  }
  const ponyfillResponse = new PonyfillResponse(responseBody, {
    status: undiciData.statusCode,
    headers: undiciData.headers,
    url: fetchRequest.url,
  });

  return ponyfillResponse;
}
