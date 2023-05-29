import { createReadStream } from 'fs';
import { fileURLToPath } from 'url';
import { PonyfillBlob } from './Blob';
import { PonyfillResponse } from './Response';

export function getResponseForFile(url: string) {
  const path = fileURLToPath(url);
  const readable = createReadStream(path);
  return new PonyfillResponse(readable);
}

const BASE64_SUFFIX = ';base64';

export function getResponseForDataUri(url: URL) {
  const [mimeType = 'text/plain', ...datas] = url.pathname.split(',');
  const data = decodeURIComponent(datas.join(','));
  if (mimeType.endsWith(BASE64_SUFFIX)) {
    const buffer = Buffer.from(data, 'base64url');
    const realMimeType = mimeType.slice(0, -BASE64_SUFFIX.length);
    const blob = new PonyfillBlob([buffer], { type: realMimeType });
    return new PonyfillResponse(blob, {
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
