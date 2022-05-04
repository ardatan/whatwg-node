module.exports = function createNodePonyfill(opts = {}) {
  const ponyfills = {};
  ponyfills.fetch = globalThis.fetch; // To enable: import {fetch} from 'cross-fetch'
  ponyfills.Headers = globalThis.Headers;
  ponyfills.Request = globalThis.Request;
  ponyfills.Response = globalThis.Response;
  ponyfills.FormData = globalThis.FormData;
  ponyfills.AbortController = globalThis.AbortController;
  ponyfills.ReadableStream = globalThis.ReadableStream;
  ponyfills.WritableStream = globalThis.WritableStream;
  ponyfills.TransformStream = globalThis.TransformStream;
  ponyfills.Blob = globalThis.Blob;
  ponyfills.File = globalThis.File;
  ponyfills.crypto = globalThis.crypto;

  if (!ponyfills.AbortController) {
    const abortControllerModule = require("abort-controller");
    ponyfills.AbortController =
      abortControllerModule.default || abortControllerModule;
  }

  if (!ponyfills.Blob) {
    const bufferModule = require('buffer')
    ponyfills.Blob = bufferModule.Blob;
  }

  if (!ponyfills.Blob) {
    const formDataModule = require("formdata-node");
    ponyfills.Blob = formDataModule.Blob
  }

  if (!ponyfills.ReadableStream) {
    try {
      const streamsWeb = require("stream/web");

      ponyfills.ReadableStream = streamsWeb.ReadableStream;
      ponyfills.WritableStream = streamsWeb.WritableStream;
      ponyfills.TransformStream = streamsWeb.TransformStream;
    } catch (e) {
      const streamsWeb = require("web-streams-polyfill/ponyfill");
      ponyfills.ReadableStream = streamsWeb.ReadableStream;
      ponyfills.WritableStream = streamsWeb.WritableStream;
      ponyfills.TransformStream = streamsWeb.TransformStream;
    }
  }

  if (!ponyfills.crypto) {
    const cryptoModule = require("crypto");
    ponyfills.crypto = cryptoModule.webcrypto;
  }

  // If any of classes of Fetch API is missing, we need to ponyfill them.
  if (!ponyfills.fetch ||
    !ponyfills.Request ||
    !ponyfills.Headers ||
    !ponyfills.Response ||
    !ponyfills.FormData ||
    !ponyfills.File ||
    // If it is pollyfilled with node-fetch, we should ignore it
    ponyfills.Request.prototype.textConverted ||
    opts.useNodeFetch) {

    const [
      nodeMajorStr,
      nodeMinorStr
    ] = process.versions.node.split('.');

    const nodeMajor = parseInt(nodeMajorStr);
    const nodeMinor = parseInt(nodeMinorStr);
    const getFormDataMethod = require('./getFormDataMethod');

    if (!opts.useNodeFetch && (nodeMajor > 16 || (nodeMajor === 16 && nodeMinor >= 5))) {
      const undici = require("undici");

      ponyfills.Headers = undici.Headers;

      const streams = require("stream");

      class Request extends undici.Request {
        constructor(requestOrUrl, options) {
          if (typeof requestOrUrl === "string") {
            options = options || {};
            if (options.body != null && options.body.read && options.body.on) {
              const readable = options.body;
              options.body = new ponyfills.ReadableStream({
                pull(controller) {
                  const chunk = readable.read();
                  if (chunk != null) {
                    controller.enqueue(chunk);
                  } else {
                    controller.close();
                  }
                },
                close(e) {
                  readable.destroy(e);
                }
              })
            }
            super(requestOrUrl, options);
            const contentType = this.headers.get("content-type");
            if (contentType && contentType.startsWith("multipart/form-data")) {
              this.headers.set("content-type", contentType.split(', ')[0]);
            }
          } else {
            super(requestOrUrl);
          }
          this.formData = getFormDataMethod(undici.File, opts.formDataLimits);
        }
      }

      ponyfills.Request = Request;
      
      const fetch = function (requestOrUrl, options) {
        if (typeof requestOrUrl === "string") {
          return fetch(new Request(requestOrUrl, options));
        }
        return undici.fetch(requestOrUrl);
      };

      ponyfills.fetch = fetch;

      ponyfills.Response = undici.Response;

      ponyfills.FormData = undici.FormData;
      ponyfills.File = undici.File
    } else {
      const nodeFetch = require("node-fetch");
      const realFetch = nodeFetch.default || nodeFetch;
      ponyfills.Headers = nodeFetch.Headers;
      const formDataEncoderModule = require("form-data-encoder");
      const streams = require("stream");
      const formDataModule = require("formdata-node");
      ponyfills.FormData = formDataModule.FormData
      ponyfills.File = formDataModule.File

      class Request extends nodeFetch.Request {
        constructor(requestOrUrl, options) {
        if (typeof requestOrUrl === "string") {
          // Support schemaless URIs on the server for parity with the browser.
          // Ex: //github.com/ -> https://github.com/
          if (/^\/\//.test(requestOrUrl)) {
            requestOrUrl = "https:" + requestOrUrl;
          }
          options = options || {};
          options.headers = new nodeFetch.Headers(options.headers || {});
          options.headers.set('Connection', 'keep-alive');
          if (options.body != null) {
            if (options.body[Symbol.toStringTag] === 'FormData') {
              const encoder = new formDataEncoderModule.FormDataEncoder(options.body)
              for (const headerKey in encoder.headers) {
                options.headers.set(headerKey, encoder.headers[headerKey])
              }
              options.body = streams.Readable.from(encoder.encode());
            }
            if (options.body[Symbol.toStringTag] === 'ReadableStream') {
              options.body = streams.Readable.from(options.body);
            }
          }
          super(requestOrUrl, options);
        } else {
          super(requestOrUrl);
        }
          this.formData = getFormDataMethod(formDataModule.File, opts.formDataLimits);
        }
      }
      ponyfills.Request = Request;
      const fetch = function (requestOrUrl, options) {
        if (typeof requestOrUrl === "string") {
          return fetch(new Request(requestOrUrl, options));
        }
        return realFetch(requestOrUrl);
      };

      ponyfills.fetch = fetch;

      ponyfills.Response = function Response(body, init) {
        if (body != null && body[Symbol.toStringTag] === 'ReadableStream') {
          const actualBody = streams.Readable.from(body);
          // Polyfill ReadableStream is not working well with node-fetch's Response
          return new nodeFetch.Response(actualBody, init);
        }
        return new nodeFetch.Response(body, init);
      };

    }
  }
  return ponyfills;
}
