/* eslint-disable @typescript-eslint/no-this-alias */
import { Readable } from 'stream';
import type { CurlyOptions } from 'node-libcurl/dist/curly.js';
import type { EasyNativeBinding } from 'node-libcurl/dist/types/index.js';
import { PonyfillHeaders } from './Headers.js';
import { PonyfillRequest } from './Request.js';
import { PonyfillResponse } from './Response.js';
import { defaultHeadersSerializer } from './utils.js';

export async function fetchCurl<TResponseJSON = any, TRequestJSON = any>(
  fetchRequest: PonyfillRequest<TRequestJSON>,
): Promise<PonyfillResponse<TResponseJSON>> {
  const nodeReadable = (
    fetchRequest.body != null
      ? 'pipe' in fetchRequest.body
        ? fetchRequest.body
        : Readable.from(fetchRequest.body)
      : null
  ) as Readable | null;

  const headersSerializer = fetchRequest.headersSerializer || defaultHeadersSerializer;

  let size: number | undefined;

  const curlyHeaders: string[] = headersSerializer(fetchRequest.headers, value => {
    size = Number(value);
  });

  let easyNativeBinding: EasyNativeBinding | undefined;

  const curlyOptions: CurlyOptions = {
    sslVerifyPeer: false,
    // we want the unparsed binary response to be returned as a stream to us
    curlyStreamResponse: true,
    curlyResponseBodyParser: false,
    curlyProgressCallback() {
      if (easyNativeBinding == null) {
        easyNativeBinding = this;
      }
      return fetchRequest['_signal']?.aborted ? 1 : 0;
    },
    upload: nodeReadable != null,
    transferEncoding: false,
    httpTransferDecoding: true,
    followLocation: fetchRequest.redirect === 'follow',
    maxRedirs: 20,
    acceptEncoding: '',
    curlyStreamUpload: nodeReadable,
    // this will just make libcurl use their own progress function (which is pretty neat)
    // curlyProgressCallback() { return CurlProgressFunc.Continue },
    // verbose: true,
    httpHeader: curlyHeaders,
    customRequest: fetchRequest.method,
  };

  if (size != null) {
    curlyOptions.inFileSize = size;
  }

  const { curly, CurlCode, CurlPause }: typeof import('node-libcurl') = (globalThis as any)[
    'libcurl'
  ];

  if (fetchRequest['_signal']) {
    fetchRequest['_signal'].onabort = () => {
      if (easyNativeBinding != null) {
        easyNativeBinding.pause(CurlPause.Recv);
      }
    };
  }

  const curlyResult = await curly(fetchRequest.url, curlyOptions);

  const responseHeaders = new PonyfillHeaders();
  curlyResult.headers.forEach(headerInfo => {
    for (const key in headerInfo) {
      if (key === 'location' || (key === 'Location' && fetchRequest.redirect === 'error')) {
        throw new Error('redirects are not allowed');
      }
      if (key !== 'result') {
        responseHeaders.append(key, headerInfo[key]);
      }
    }
  });
  curlyResult.data.on('error', (err: any) => {
    if (err.isCurlError && err.code === CurlCode.CURLE_ABORTED_BY_CALLBACK) {
      // this is expected
    } else {
      throw err;
    }
  });

  return new PonyfillResponse(curlyResult.data, {
    status: curlyResult.statusCode,
    headers: responseHeaders,
    url: fetchRequest.url,
  });
}
