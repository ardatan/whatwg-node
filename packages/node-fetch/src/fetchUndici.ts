import { STATUS_CODES } from 'node:http';
import { PassThrough, Readable } from 'node:stream';
import zlib from 'node:zlib';
import type { Dispatcher } from 'undici';
import { fakeRejectPromise } from '@whatwg-node/promise-helpers';
import { getHttpsCheckServerIdentity } from './checkServerIdentity.js';
import { getUndici } from './getUndici.js';
import { PonyfillRequest } from './Request.js';
import { PonyfillResponse } from './Response.js';
import { DEFAULT_ACCEPT_ENCODING, getHeadersObj, isNodeReadable, shouldRedirect } from './utils.js';

let sharedAgent: Dispatcher | undefined;
const ephemeralAgents = new Set<Dispatcher>();
const pendingAgentTeardowns = new Set<Promise<void>>();

async function teardownDispatcher(dispatcher: Dispatcher): Promise<void> {
  try {
    await dispatcher.close();
  } catch {
    // ignore
  }
  try {
    await dispatcher.destroy();
  } catch {
    // ignore
  }
}

function trackTeardown(dispatcher: Dispatcher): Promise<void> {
  const job = teardownDispatcher(dispatcher).finally(() => {
    pendingAgentTeardowns.delete(job);
  });
  pendingAgentTeardowns.add(job);
  return job;
}

/** Close shared / ephemeral undici agents (leak tests / suite teardown). */
export async function closeSharedUndiciAgent(): Promise<void> {
  const agent = sharedAgent;
  sharedAgent = undefined;
  const pending = [...ephemeralAgents];
  ephemeralAgents.clear();

  for (const dispatcher of [agent, ...pending]) {
    if (dispatcher) {
      trackTeardown(dispatcher);
    }
  }
  await Promise.all([...pendingAgentTeardowns]);
}

function wrapDnsSkipBracketedIPv6(
  dnsInterceptor: Dispatcher.DispatcherComposeInterceptor,
): Dispatcher.DispatcherComposeInterceptor {
  // Node 25+ keeps brackets in URL.hostname for IPv6 (`[::1]`). undici's dns
  // interceptor uses `isIP(hostname)` which fails on bracketed forms and then
  // `dns.lookup('[::1]')` throws ENOTFOUND. Skip the interceptor for those hosts.
  return dispatch => {
    const withDns = dnsInterceptor(dispatch);
    return (opts, handler) => {
      if (opts.origin != null) {
        const origin = opts.origin instanceof URL ? opts.origin : new URL(String(opts.origin));
        if (origin.hostname.startsWith('[')) {
          return dispatch(opts, handler);
        }
      }
      return withDns(opts, handler);
    };
  };
}

function createComposedAgent(): Dispatcher {
  const undici = getUndici();
  if (!undici) {
    throw new Error('undici is not available');
  }
  // allowH2 defaults to true in undici; only override TLS identity when this
  // Node build still has the IPv6 IP-SAN regression (same as fetchNodeHttp).
  const checkServerIdentity = getHttpsCheckServerIdentity();
  const agentOpts: Record<string, unknown> = checkServerIdentity
    ? {
        connect: {
          checkServerIdentity,
        },
      }
    : {};
  if (process.env.LEAK_TEST) {
    // Prefer short-lived sockets so --detectLeaks does not retain keep-alive pools.
    agentOpts.connections = 1;
    agentOpts.pipelining = 0;
    agentOpts.keepAliveTimeout = 1;
    agentOpts.keepAliveMaxTimeout = 1;
  }
  const agent = new undici.Agent(agentOpts);
  // dns → redirect → decompress → agent. Per-request `maxRedirections` overrides
  // redirect (0 = manual/error passthrough, >0 = follow).
  // Skip dns under LEAK_TEST: maxTTL:0 races with null addr records, and the
  // cache timers can pin the Jest isolate under --detectLeaks.
  if (process.env.LEAK_TEST) {
    return agent.compose(undici.interceptors.redirect(), undici.interceptors.decompress());
  }
  return agent.compose(
    wrapDnsSkipBracketedIPv6(
      undici.interceptors.dns({
        maxTTL: 10 * 60 * 1000,
      }),
    ),
    undici.interceptors.redirect(),
    undici.interceptors.decompress(),
  );
}

function getAgent(): { dispatcher: Dispatcher; ephemeral: boolean } {
  // Leak tests use a fresh agent per request so pools are not retained in the
  // module-level singleton after the suite ends.
  if (process.env.LEAK_TEST) {
    const dispatcher = createComposedAgent();
    ephemeralAgents.add(dispatcher);
    return { dispatcher, ephemeral: true };
  }
  if (!sharedAgent) {
    sharedAgent = createComposedAgent();
  }
  return { dispatcher: sharedAgent, ephemeral: false };
}

/**
 * `interceptors.decompress` does not handle deflate-raw; keep a tiny fallback.
 */
function createDeflateRawFallback(contentEncoding: string | string[] | undefined) {
  const encoding = Array.isArray(contentEncoding)
    ? contentEncoding[0]
    : contentEncoding?.split(',')[0]?.trim();
  if (encoding === 'deflate-raw' || encoding === 'x-deflate-raw') {
    return zlib.createInflateRaw();
  }
  return undefined;
}

function getRequestBody(fetchRequest: PonyfillRequest): string | Buffer | Readable | null {
  if (fetchRequest['_buffer'] != null) {
    return fetchRequest['_buffer'] as Buffer;
  }
  if (fetchRequest['bodyType'] === 'String') {
    return fetchRequest['bodyInit'] as string;
  }
  if (fetchRequest.body == null) {
    return null;
  }
  return isNodeReadable(fetchRequest.body)
    ? (fetchRequest.body as Readable)
    : Readable.from(fetchRequest.body);
}

function maxRedirectionsFor(redirect: RequestRedirect | undefined): number {
  // Fetch `follow` mirrors common undici/fetch defaults (20).
  return redirect === 'follow' ? 20 : 0;
}

export function fetchUndici<TResponseJSON = any, TRequestJSON = any>(
  fetchRequest: PonyfillRequest<TRequestJSON>,
): Promise<PonyfillResponse<TResponseJSON>> {
  const undici = getUndici();
  if (!undici) {
    return fakeRejectPromise(new Error('undici is not available'));
  }

  const headersSerializer: typeof getHeadersObj =
    (fetchRequest.headersSerializer as any) || getHeadersObj;
  const headers = headersSerializer(fetchRequest.headers);
  headers['accept-encoding'] ||= DEFAULT_ACCEPT_ENCODING;
  if (headers['user-agent'] == null && headers['User-Agent'] == null) {
    headers['user-agent'] = 'node';
  }

  let signal: AbortSignal | undefined;
  if (fetchRequest._signal === null) {
    signal = undefined;
  } else if (fetchRequest._signal) {
    signal = fetchRequest._signal;
  }

  if (signal?.aborted) {
    return fakeRejectPromise(signal.reason ?? new Error('The operation was aborted.'));
  }

  const requestUrl = fetchRequest.parsedUrl || fetchRequest.url;
  const parsedUrl = undici.parseURL(requestUrl);
  const body = getRequestBody(fetchRequest);
  const { dispatcher, ephemeral } = getAgent();

  return new Promise<PonyfillResponse<TResponseJSON>>((resolve, reject) => {
    let outputStream: PassThrough | undefined;
    let settled = false;
    let redirectHistoryLength = 0;
    let dispatchController: Dispatcher.DispatchController | undefined;
    let removeAbortListener: (() => void) | undefined;
    let released = false;

    function releaseEphemeralAgent() {
      if (!ephemeral || released) {
        return;
      }
      released = true;
      ephemeralAgents.delete(dispatcher);
      trackTeardown(dispatcher).catch(() => undefined);
    }

    function abortError(reason: unknown, fallbackMessage: string): Error {
      if (reason instanceof Error) {
        return reason;
      }
      if (typeof reason === 'string' && reason) {
        return new Error(reason);
      }
      return new Error(fallbackMessage);
    }

    function settleReject(error: unknown) {
      if (settled) {
        outputStream?.destroy(abortError(error, 'Request failed'));
        releaseEphemeralAgent();
        return;
      }
      settled = true;
      removeAbortListener?.();
      releaseEphemeralAgent();
      reject(error);
    }

    function settleResolve(response: PonyfillResponse<TResponseJSON>) {
      if (settled) {
        return;
      }
      settled = true;
      // Keep the abort listener until the body finishes so mid-stream
      // AbortSignal still tears down the undici connection / output stream.
      resolve(response);
    }

    if (signal) {
      const onAbort = () => {
        // Preserve AbortSignal.reason for the fetch rejection (WPT); undici
        // DispatchController.abort requires an Error instance.
        const reason = signal.reason ?? new Error('The operation was aborted.');
        removeAbortListener?.();
        dispatchController?.abort(abortError(reason, 'The operation was aborted.'));
        outputStream?.destroy(abortError(reason, 'The operation was aborted.'));
        settleReject(reason);
      };
      signal.addEventListener('abort', onAbort, { once: true });
      removeAbortListener = () => signal.removeEventListener('abort', onAbort);
    }

    try {
      dispatcher.dispatch(
        {
          origin: parsedUrl.origin,
          path: parsedUrl.search ? `${parsedUrl.pathname}${parsedUrl.search}` : parsedUrl.pathname,
          method: fetchRequest.method as Dispatcher.HttpMethod,
          headers,
          body: body ?? undefined,
          // @ts-expect-error undici redirect interceptor reads this from dispatch opts
          maxRedirections: maxRedirectionsFor(fetchRequest.redirect),
        },
        {
          onRequestStart(controller, context) {
            dispatchController = controller;
            if (Array.isArray(context?.history)) {
              redirectHistoryLength = context.history.length;
            }
            if (signal?.aborted) {
              controller.abort(abortError(signal.reason, 'The operation was aborted.'));
            }
          },
          onResponseStart(controller, statusCode, responseHeaders, statusMessage) {
            if (statusCode < 200) {
              return;
            }

            const locationHeader = responseHeaders.location;
            const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;

            // maxRedirections: 0 leaves 3xx to us for Fetch redirect: 'error' | 'manual'.
            if (fetchRequest.redirect === 'error' && location && shouldRedirect(statusCode)) {
              const redirectError = new Error('Redirects are not allowed');
              settleReject(redirectError);
              controller.abort(redirectError);
              return;
            }

            outputStream =
              createDeflateRawFallback(responseHeaders['content-encoding']) || new PassThrough();

            // Response may already be resolved; still honor later aborts.
            if (signal?.aborted) {
              const reason = signal.reason ?? new Error('The operation was aborted.');
              controller.abort(abortError(reason, 'The operation was aborted.'));
              outputStream.destroy(abortError(reason, 'The operation was aborted.'));
              settleReject(reason);
              return;
            }

            outputStream.on('drain', () => {
              controller.resume();
            });
            outputStream.on('error', err => {
              controller.abort(abortError(err, 'Response stream error'));
            });
            outputStream.on('close', () => {
              releaseEphemeralAgent();
            });
            if (ephemeral) {
              // Leak tests often leave bodies unread; resume so the socket can
              // finish and the ephemeral agent can be destroyed.
              queueMicrotask(() => {
                if (!outputStream!.destroyed && outputStream!.listenerCount('data') === 0) {
                  outputStream!.resume();
                }
              });
            }
            let statusText = statusMessage || STATUS_CODES[statusCode];
            if (statusText == null) {
              statusText = '';
            }

            const response = new PonyfillResponse(outputStream, {
              status: statusCode,
              statusText,
              headers: responseHeaders as Record<string, string>,
              url: fetchRequest.url,
              signal,
            });
            if (redirectHistoryLength > 0) {
              response.redirected = true;
            }
            settleResolve(response);
          },
          onResponseData(controller, chunk) {
            if (!outputStream) {
              return;
            }
            if (!outputStream.write(chunk)) {
              controller.pause();
            }
          },
          onResponseEnd() {
            removeAbortListener?.();
            outputStream?.end();
            if (!outputStream) {
              releaseEphemeralAgent();
            }
          },
          onResponseError(_controller, error) {
            settleReject(error);
            outputStream?.destroy(error);
          },
        },
      );
    } catch (error) {
      settleReject(error);
    }
  });
}
