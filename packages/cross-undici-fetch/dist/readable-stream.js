const { Readable } = require("stream");

module.exports = class ReadableStream extends Readable {
  started = false;
  constructor(underlyingSource, opts) {
    super(opts);
    this.underlyingSource = underlyingSource;
    this.controller = {
      desiredSize: Infinity,
      enqueue: (chunk) => this.push(chunk),
      error: (e) => this.destroy(e),
      close: () => this.push(null),
    };
  }

  _read() {
    if (!this.started) {
      this.started = true;
      if (this.underlyingSource.start) {
        this.underlyingSource.start(this.controller).then(() => {
          this.underlyingSource.pull(this.controller);
        });
      }
    } else {
      if (this.underlyingSource.pull) {
        this.underlyingSource.pull(this.controller);
      }
    }
  }

  _destroy(reason) {
    if (this.underlyingSource.cancel) {
      this.underlyingSource.cancel(reason);
    }
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
      releaseLock: () => asyncIterator.return && asyncIterator.return(),
      close: () => asyncIterator.return && asyncIterator.return(),
      cancel: e => e ? (asyncIterator.throw && asyncIterator.throw()) : (asyncIterator.return && asyncIterator.return()),
    };
  }

  pipeTo(destination) {
    return this.pipe(destination);
  }

  pipeThrough(destination) {
    return this.pipe(destination);
  }
};
