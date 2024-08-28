export class PonyfillSuppressedError extends Error implements SuppressedError {
  // eslint-disable-next-line n/handle-callback-err
  constructor(
    public error: any,
    public suppressed: any,
    message?: string,
  ) {
    super(message);
    this.name = 'SuppressedError';
    Error.captureStackTrace(this, this.constructor);
  }
}
