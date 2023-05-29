import { Readable } from 'stream';
import { createBrotliDecompress, createGunzip, createInflate } from 'zlib';
import { request } from 'undici';
import { PonyfillRequest, RequestPonyfillInit } from './Request.js';
import { PonyfillResponse } from './Response.js';
import { PonyfillURL } from './URL.js';
import { getHeadersObj, getResponseForDataUri, getResponseForFile } from './utils.js';

export async function fetchViaUndici<TResponseJSON = any, TRequestJSON = any>(
  info: string | PonyfillRequest<TRequestJSON> | URL,
  init?: RequestPonyfillInit,
): Promise<PonyfillResponse<TResponseJSON>> {
  if (typeof info === 'string' || 'href' in info) {
    const ponyfillRequest = new PonyfillRequest(info, init);
    return fetchViaUndici(ponyfillRequest);
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
      ? fetchRequest['bodyInit']
      : fetchRequest.body != null
      ? 'pipe' in fetchRequest.body
        ? fetchRequest.body
        : Readable.from(fetchRequest.body)
      : null
  ) as Readable | null;

  const headersSerializer = fetchRequest.headersSerializer || getHeadersObj;
  const nodeHeaders = headersSerializer(fetchRequest.headers);
  if ((requestBody as any)?.[Symbol.toStringTag] === 'FormData') {
    delete nodeHeaders['content-type'];
  }
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
