const streams = require('stream');

module.exports = function readableStreamToReadable(readableStream) {
  const reader = readableStream.getReader();
  return new streams.Readable({
    read() {
      reader.read().then(({ done, value }) => {
        if (done) {
          this.push(null);
        } else {
          this.push(value);
        }
      })
    },
    async destroy(err, callback) {
      try {
          reader.cancel();
          reader.releaseLock();
          await readableStream.cancel();
          callback();
      } catch (error) {
          callback(error);
      }
    }
  })
}