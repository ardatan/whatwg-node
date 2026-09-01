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
  return signal.reason ?? createDefaultAbortError();
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
