import { Readable } from 'node:stream';
import { PonyfillAbortError } from './AbortError.js';
import { PonyfillRequest } from './Request.js';
import { PonyfillResponse } from './Response.js';
import { defaultHeadersSerializer, isNodeReadable } from './utils.js';

export function fetchCurl<TResponseJSON = any, TRequestJSON = any>(
  fetchRequest: PonyfillRequest<TRequestJSON>,
): Promise<PonyfillResponse<TResponseJSON>> {
  const { Curl, CurlCode, CurlFeature, CurlPause, CurlProgressFunc } = globalThis['libcurl'];

  const curlHandle = new Curl();

  curlHandle.enable(CurlFeature.NoDataParsing);

  curlHandle.setOpt('URL', fetchRequest.url);

  curlHandle.setOpt('SSL_VERIFYPEER', false);

  curlHandle.enable(CurlFeature.StreamResponse);

  curlHandle.setStreamProgressCallback(function () {
    return fetchRequest['_signal']?.aborted
      ? process.env.DEBUG
        ? CurlProgressFunc.Continue
        : 1
      : 0;
  });

  if (fetchRequest['bodyType'] === 'String') {
    curlHandle.setOpt('POSTFIELDS', fetchRequest['bodyInit'] as string);
  } else {
    const nodeReadable = (
      fetchRequest.body != null
        ? isNodeReadable(fetchRequest.body)
          ? fetchRequest.body
          : Readable.from(fetchRequest.body)
        : null
    ) as Readable | null;

    if (nodeReadable) {
      curlHandle.setOpt('UPLOAD', true);
      curlHandle.setUploadStream(nodeReadable);
    }
  }

  if (process.env.DEBUG) {
    curlHandle.setOpt('VERBOSE', true);
  }

  curlHandle.setOpt('TRANSFER_ENCODING', false);
  curlHandle.setOpt('HTTP_TRANSFER_DECODING', true);
  curlHandle.setOpt('FOLLOWLOCATION', fetchRequest.redirect === 'follow');
  curlHandle.setOpt('MAXREDIRS', 20);
  curlHandle.setOpt('ACCEPT_ENCODING', '');
  curlHandle.setOpt('CUSTOMREQUEST', fetchRequest.method);

  const headersSerializer = fetchRequest.headersSerializer || defaultHeadersSerializer;

  let size: number | undefined;

  const curlHeaders: string[] = headersSerializer(fetchRequest.headers, value => {
    size = Number(value);
  });

  if (size != null) {
    curlHandle.setOpt('INFILESIZE', size);
  }

  curlHandle.setOpt('HTTPHEADER', curlHeaders);

  curlHandle.enable(CurlFeature.NoHeaderParsing);

  return new Promise(function promiseResolver(resolve, reject) {
    let streamResolved = false;
    if (fetchRequest['_signal']) {
      fetchRequest['_signal'].onabort = () => {
        if (streamResolved) {
          curlHandle.pause(CurlPause.Recv);
        } else {
          reject(new PonyfillAbortError());
          curlHandle.close();
        }
      };
    }
    curlHandle.once('end', function endListener() {
      curlHandle.close();
    });
    curlHandle.once('error', function errorListener(error: any) {
      if (error.isCurlError && error.code === CurlCode.CURLE_ABORTED_BY_CALLBACK) {
        // this is expected
      } else {
        // this is unexpected
        reject(error);
      }
      curlHandle.close();
    });
    curlHandle.once(
      'stream',
      function streamListener(stream: Readable, status: number, headersBuf: Buffer) {
        const headersFlat = headersBuf
          .toString('utf8')
          .split(/\r?\n|\r/g)
          .filter(headerFilter => {
            if (headerFilter && !headerFilter.startsWith('HTTP/')) {
              if (
                fetchRequest.redirect === 'error' &&
                (headerFilter.includes('location') || headerFilter.includes('Location'))
              ) {
                reject(new Error('redirect is not allowed'));
              }
              return true;
            }
            return false;
          });
        const headersInit = headersFlat.map(
          headerFlat => headerFlat.split(/:\s(.+)/).slice(0, 2) as [string, string],
        );
        resolve(
          new PonyfillResponse(stream, {
            status,
            headers: headersInit,
            url: fetchRequest.url,
          }),
        );
        streamResolved = true;
      },
    );
    curlHandle.perform();
  });
}
