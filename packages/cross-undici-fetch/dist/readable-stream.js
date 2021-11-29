const { Readable } = require("stream");

module.exports = class ReadableStream extends Readable {
  constructor(underlyingSource) {
    super({
      read() {},
    });
    this.underlyingSource = underlyingSource;
    this.controller = {
      desiredSize: Infinity,
      enqueue: (chunk) => this.push(chunk),
      error: (e) => this.destroy(e),
      close: () => this.push(null),
    };
    this.underlyingSource.start?.(this.controller);
    this.on("close", () => this.underlyingSource.cancel?.(this.controller));
  }

  get locked() {
    return this.destroyed;
  }

  async cancel(reason) {
    this.destroy(reason);
  }

  getReader() {
    const asyncIterator = this[Symbol.asyncIterator]();
    return {
      read: () => asyncIterator.next(),
      releaseLock: () => asyncIterator.return?.(),
      close: () => asyncIterator.return?.(),
      cancel: e => e ? asyncIterator?.throw(e) : asyncIterator.return?.(),
    };
  }

  pipeTo(destination) {
    return this.pipe(destination);
  }

  pipeThrough(destination) {
    return this.pipe(destination);
  }
};
