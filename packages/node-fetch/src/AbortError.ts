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

export function getAbortRejection(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted', 'AbortError');
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
  return new DOMException('The operation was aborted', 'AbortError');
}
