const [
  nodeMajorStr,
  nodeMinorStr
] = process.versions.node.split('.');

const nodeMajor = parseInt(nodeMajorStr);
const nodeMinor = parseInt(nodeMinorStr);

if (nodeMajor > 16 || (nodeMajor === 16 && nodeMinor >= 5)) {
  const undici = require("undici");

  const fetch = function (requestOrUrl, options) {
    if (typeof requestOrUrl === "string") {
      return fetch(new exports.Request(requestOrUrl, options));
    }
    return undici.fetch(requestOrUrl);
  };

  fetch.ponyfill = true;

  module.exports = exports = fetch;
  exports.fetch = fetch;
  exports.Headers = undici.Headers;

  const patchHeadersList = require("./patch-headers-list");
  const { HeadersList } = require('undici/lib/fetch/headers');
  patchHeadersList(HeadersList);

  exports.Request = function Request(requestOrUrl, options) {
    if (typeof requestOrUrl === "string") {
      options = options || {};
      options.headers = new exports.Headers(options.headers || {});
      options.headers.delete("connection");
      return new undici.Request(requestOrUrl, options);
    }
    const newRequestObj = requestOrUrl.clone();
    Object.defineProperty(newRequestObj, 'headers', {
      value: newRequestObj.headers || new exports.Headers({})
    });
    newRequestObj.headers.delete("connection");
    return newRequestObj;
  };
  exports.Response = undici.Response;
  exports.FormData = undici.FormData;
  exports.AbortController = globalThis.AbortController;

  const bufferModule = require('buffer')
  exports.Blob = bufferModule.Blob;

  const streamsWeb = require("stream/web");

  exports.ReadableStream = streamsWeb.ReadableStream;
  exports.WritableStream = streamsWeb.WritableStream;
  exports.TransformStream = streamsWeb.TransformStream;

  exports.File = undici.File

  const addFormDataToRequest = require('./add-formdata-to-request');
  addFormDataToRequest(undici.Request, undici.File, undici.FormData);

  // Needed for TypeScript consumers without esModuleInterop.
  exports.default = fetch;
} else {
  const nodeFetch = require("node-fetch");
  const realFetch = nodeFetch.default || nodeFetch;

  const fetch = function (requestOrUrl, options) {
    if (typeof requestOrUrl === "string") {
      return fetch(new exports.Request(requestOrUrl, options));
    }
    return realFetch(requestOrUrl);
  };

  fetch.ponyfill = true;

  module.exports = exports = fetch;
  exports.fetch = fetch;
  exports.Headers = nodeFetch.Headers;
  const formDataEncoderModule = require("form-data-encoder");
  const streams = require("stream");
  exports.Request = function (requestOrUrl, options) {
    if (typeof requestOrUrl === "string") {
      // Support schemaless URIs on the server for parity with the browser.
      // Ex: //github.com/ -> https://github.com/
      if (/^\/\//.test(requestOrUrl)) {
        requestOrUrl = "https:" + requestOrUrl;
      }
      options = options || {};
      options.headers = new nodeFetch.Headers(options.headers || {});
      options.headers.set('Connection', 'keep-alive');
      if (options.body instanceof formDataModule.FormData) {
        options.headers = new nodeFetch.Headers(options.headers || {});
        const encoder = new formDataEncoderModule.FormDataEncoder(options.body)
        for (const headerKey in encoder.headers) {
          options.headers.set(headerKey, encoder.headers[headerKey])
        }
        options.body = streams.Readable.from(encoder.encode());
      }
      return new nodeFetch.Request(requestOrUrl, options);
    }
    return requestOrUrl.clone();
  };
  exports.Response = function Response(body, init) {
    if (body instanceof exports.ReadableStream) {
      // Polyfill ReadableStream is not working well with node-fetch's Response
      return new nodeFetch.Response(streams.Readable.from(body), init);
    }
    return new nodeFetch.Response(body, init);
  };

  const abortControllerModule = require("abort-controller");
  exports.AbortController =
    abortControllerModule.default || abortControllerModule;

  const formDataModule = require("formdata-node");
  exports.FormData = formDataModule.FormData
  exports.Blob = formDataModule.Blob
  exports.File = formDataModule.File

  const streamsWeb = require("web-streams-polyfill/ponyfill");
  exports.ReadableStream = streamsWeb.ReadableStream;
  exports.WritableStream = streamsWeb.WritableStream;
  exports.TransformStream = streamsWeb.TransformStream;

  // Needed for TypeScript consumers without esModuleInterop.
  exports.default = fetch;

  const addFormDataToRequest = require('./add-formdata-to-request');
  addFormDataToRequest(nodeFetch.Request, formDataModule.File, exports.FormData);
}
