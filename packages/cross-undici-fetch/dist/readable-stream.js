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
    return {
      read: () =>
        new Promise((resolve) => {
          this.once("data", (value) => resolve({ value, done: false }));
          this.once("close", () => resolve({ done: true }));
        }),
      releaseLock: () => this.push(null),
      close: () => this.push(null),
      cancel: (e) => this.destroy(e),
    };
  }

  pipeTo(destination) {
    return this.pipe(destination);
  }

  pipeThrough(destination) {
    return this.pipe(destination);
  }
};
