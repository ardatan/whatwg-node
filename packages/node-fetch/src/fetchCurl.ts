import { Buffer } from 'node:buffer';
import { PassThrough, Readable } from 'node:stream';
import { rootCertificates } from 'node:tls';
import { createDeferredPromise } from '@whatwg-node/promise-helpers';
import { PonyfillAbortError } from './AbortError.js';
import { getLibcurlMulti } from './libcurlMulti.js';
import { PonyfillRequest } from './Request.js';
import { PonyfillResponse } from './Response.js';
import { defaultHeadersSerializer, isNodeReadable, shouldRedirect } from './utils.js';

function isCurlAbortError(error: { message?: string }) {
  return (
    error.message === 'Operation was aborted by an application callback' ||
    // node-libcurl >= 5
    error.message === 'Request was aborted by a callback'
  );
}

export function fetchCurl<TResponseJSON = any, TRequestJSON = any>(
  fetchRequest: PonyfillRequest<TRequestJSON>,
): Promise<PonyfillResponse<TResponseJSON>> {
  const { Curl, CurlFeature, CurlProgressFunc } = globalThis['libcurl'];

  const curlHandle = new Curl();
  // Keep requests off node-libcurl's process-default Multi so tests can dispose
  // the uv timer / ObjectWrap Ref after the suite (see disposeLibcurlMulti).
  curlHandle.setMulti(getLibcurlMulti());

  curlHandle.enable(CurlFeature.NoDataParsing);

  curlHandle.setOpt('URL', fetchRequest.url);

  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    curlHandle.setOpt('SSL_VERIFYPEER', false);
  }

  if (process.env.NODE_EXTRA_CA_CERTS) {
    curlHandle.setOpt('CAINFO', process.env.NODE_EXTRA_CA_CERTS);
  } else {
    curlHandle.setOpt('CAINFO_BLOB', rootCertificates.join('\n'));
  }

  curlHandle.enable(CurlFeature.StreamResponse);

  let signal: AbortSignal | undefined;
  if (fetchRequest._signal === null) {
    signal = undefined;
  } else if (fetchRequest._signal) {
    signal = fetchRequest._signal;
  }

  curlHandle.setStreamProgressCallback(function () {
    return signal?.aborted ? (process.env.DEBUG ? CurlProgressFunc.Continue : 1) : 0;
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

  const deferredPromise = createDeferredPromise<PonyfillResponse<TResponseJSON>>();
  let streamResolved: Readable | undefined;
  let curlResponseStream: Readable | undefined;
  function onAbort() {
    // node-libcurl 5 + libcurl 8: pausing alone does not tear down the TCP
    // connection, so servers never see client disconnect. Destroy the response
    // stream (or close the handle) to actually abort.
    const abortError = new PonyfillAbortError(signal?.reason);
    const outputStream = streamResolved;
    const responseStream = curlResponseStream;
    if (outputStream && !outputStream.closed && !outputStream.destroyed) {
      outputStream.destroy(abortError);
    }
    if (responseStream && !responseStream.closed && !responseStream.destroyed) {
      responseStream.destroy(abortError);
    } else if (curlHandle.isOpen) {
      try {
        curlHandle.close();
      } catch (e) {
        deferredPromise.reject(e);
      }
    }
    if (!outputStream) {
      deferredPromise.reject(abortError);
    }
  }

  signal?.addEventListener('abort', onAbort, { once: true });
  curlHandle.once('end', function endListener() {
    try {
      curlHandle.close();
    } catch (e) {
      deferredPromise.reject(e);
    }
    signal?.removeEventListener('abort', onAbort);
  });
  curlHandle.once('error', function errorListener(error: any) {
    if (signal?.aborted) {
      error = new PonyfillAbortError(signal.reason);
    } else if (isCurlAbortError(error)) {
      error.message = 'The operation was aborted.';
    }
    if (streamResolved && !streamResolved.closed && !streamResolved.destroyed) {
      streamResolved.destroy(error);
    } else {
      deferredPromise.reject(error);
    }
    try {
      curlHandle.close();
    } catch (e) {
      deferredPromise.reject(e);
    }
  });
  curlHandle.once(
    'stream',
    function streamListener(stream: Readable, status: number, headersBuf: Buffer) {
      curlResponseStream = stream;
      const outputStream = stream.pipe(new PassThrough(), {
        end: true,
      });
      const headersFlat = headersBuf
        .toString('utf8')
        .split(/\r?\n|\r/g)
        .filter(headerFilter => {
          if (headerFilter && !headerFilter.startsWith('HTTP/')) {
            if (
              fetchRequest.redirect === 'error' &&
              headerFilter.toLowerCase().includes('location') &&
              shouldRedirect(status)
            ) {
              if (!stream.destroyed) {
                stream.resume();
              }
              outputStream.destroy();
              deferredPromise.reject(new Error('redirect is not allowed'));
            }
            return true;
          }
          return false;
        });
      const headersInit = headersFlat.map(
        headerFlat => headerFlat.split(/:\s(.+)/).slice(0, 2) as [string, string],
      );
      const ponyfillResponse = new PonyfillResponse(outputStream, {
        status,
        headers: headersInit,
        url: curlHandle.getInfo(Curl.info.REDIRECT_URL)?.toString() || fetchRequest.url,
        redirected: Number(curlHandle.getInfo(Curl.info.REDIRECT_COUNT)) > 0,
      });
      deferredPromise.resolve(ponyfillResponse);
      streamResolved = outputStream;
    },
  );
  setImmediate(() => {
    if (!curlHandle.isOpen || signal?.aborted) {
      if (signal?.aborted) {
        deferredPromise.reject(new PonyfillAbortError(signal.reason));
      }
      return;
    }
    curlHandle.perform();
  });
  return deferredPromise.promise;
}
