export class PonyfillAbortError extends DOMException {
  constructor(reason?: any) {
    let message = 'The operation was aborted';
    if (reason) {
      message += ` reason: ${reason}`;
    }
    super(message, 'AbortError');
    this.cause = reason;
  }

  get reason() {
    return this.cause;
  }
}
