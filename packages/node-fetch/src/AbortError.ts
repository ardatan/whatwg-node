export class PonyfillAbortError extends DOMException {
  constructor() {
    super('The operation was aborted', 'AbortError');
  }

  get reason() {
    return this.cause;
  }
}
