export class PonyfillAbortError extends Error {
  constructor(reason?: any) {
    let message = 'The operation was aborted';
    if (reason) {
      message += ` reason: ${reason}`;
    }
    super(message, {
      cause: reason,
    });
    this.name = 'AbortError';
  }

  get reason() {
    return this.cause;
  }
}

export function createDefaultAbortError(name = 'AbortError'): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The operation was aborted', name);
  }
  const error = new Error('The operation was aborted');
  error.name = name;
  return error;
}

export function getAbortRejection(signal: AbortSignal): unknown {
  if (signal.reason === undefined) {
    return createDefaultAbortError();
  }
  return signal.reason;
}

export function getAbortError(signal: AbortSignal): Error {
  const { reason } = signal;
  if (reason instanceof Error) {
    return reason;
  }
  if (reason != null) {
    const name =
      typeof reason === 'object' &&
      'name' in reason &&
      typeof (reason as { name: unknown }).name === 'string'
        ? (reason as { name: string }).name
        : 'AbortError';
    return createDefaultAbortError(name);
  }
  return createDefaultAbortError();
}

export function getFetchAbortRejection(signal: AbortSignal | undefined, error?: unknown): unknown {
  if (signal?.aborted) {
    return getAbortRejection(signal);
  }
  if (error instanceof Error) {
    return error;
  }
  if (error != null) {
    return new Error(String(error));
  }
  return createDefaultAbortError();
}
