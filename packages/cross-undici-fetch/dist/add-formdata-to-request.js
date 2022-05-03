const busboy = require('busboy');
const streams = require("stream");

class LazyFile {
  constructor({
    filename,
    mimeType,
    fileStream
  }) {
    this.name = filename;
    this.type = mimeType;
    this.buffer$ = new Promise(resolve => {
      const chunks = [];
      fileStream.on('data', chunk => {
        chunks.push(chunk);
      }).on('close', () => {
        const totalChunk = Buffer.concat(chunks);
        this.size = totalChunk.length;
        resolve(totalChunk);
      });
    });
  }
  stream() {
    return this.buffer$.then(buffer => streams.Readable.from(buffer));
  }
  text() {
    return this.buffer$.then(buffer => buffer.toString('utf-8'));
  }
  arrayBuffer() {
    return this.buffer$.then(buffer => buffer.buffer);
  }
}

module.exports = function addFormDataToRequest(Request, limits) {
  if (Request.FORMDATA_PATCHED) {
    return;
  }
  Request.FORMDATA_PATCHED = true;
  const existingFormDataMethod = Request.prototype.formData;
  Request.prototype.formData = async function formData(...args) {
    try {
      const existingResult = await existingFormDataMethod.apply(this, args);
      if (!existingResult) {
        throw new Error('Existing formData method returned undefined');
      }
    } catch(e) {
      const contentType = this.headers.get('Content-Type');
      
      if (/multipart\/form-data/.test(contentType) && this.body) {
        const nodeReadable = this.body.on ? this.body : streams.Readable.from(this.body);
        const bb = busboy({
          headers: {
            'content-type': contentType
          },
          limits,
        });
        const formData = new Map();
        bb.on('file', (name, fileStream, { filename, mimeType }) => {
          const lazyFile = new LazyFile({
            filename,
            mimeType,
            fileStream
          })
          formData.set(name, lazyFile)
        })
        bb.on('field', (name, value) => {
          formData.set(name, value)
        })
        return new Promise(resolve => {
          bb.on('close', () => {
            resolve(formData);
          });
          nodeReadable.pipe(bb);
        })
      }
    }
  }
}