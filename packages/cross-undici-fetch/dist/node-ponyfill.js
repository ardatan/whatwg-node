exports.fetch = global.fetch; // To enable: import {fetch} from 'cross-fetch'
exports.Headers = global.Headers;
exports.Request = global.Request;
exports.Response = global.Response;
exports.FormData = global.FormData;
exports.AbortController = global.AbortController;
exports.ReadableStream = global.ReadableStream;
exports.WritableStream = global.WritableStream;
exports.TransformStream = global.TransformStream;
exports.Blob = global.Blob;
exports.File = global.File;

if (!exports.AbortController) {
  const abortControllerModule = require("abort-controller");
  exports.AbortController =
    abortControllerModule.default || abortControllerModule;
}

if (!exports.Blob) {
  const bufferModule = require('buffer')
  exports.Blob = bufferModule.Blob;
}

if (!exports.Blob) {
  const formDataModule = require("formdata-node");
  exports.Blob = formDataModule.Blob
}

if (!exports.ReadableStream) {
  try {
    const streamsWeb = require("stream/web");

    exports.ReadableStream = streamsWeb.ReadableStream;
    exports.WritableStream = streamsWeb.WritableStream;
    exports.TransformStream = streamsWeb.TransformStream;
  } catch (e) {
    const streamsWeb = require("web-streams-polyfill/ponyfill");
    exports.ReadableStream = streamsWeb.ReadableStream;
    exports.WritableStream = streamsWeb.WritableStream;
    exports.TransformStream = streamsWeb.TransformStream;
  }
}

// If any of classes of Fetch API is missing, we need to ponyfill them.
if (!exports.fetch ||
  !exports.Request ||
  !exports.Headers ||
  !exports.Response ||
  // If it is pollyfilled with node-fetch, we should ignore it
  exports.Request.prototype.textConverted) {

  const [
    nodeMajorStr,
    nodeMinorStr
  ] = process.versions.node.split('.');

  const nodeMajor = parseInt(nodeMajorStr);
  const nodeMinor = parseInt(nodeMinorStr);
  const addFormDataToRequest = require('./add-formdata-to-request');

  if (nodeMajor > 16 || (nodeMajor === 16 && nodeMinor >= 5)) {
    const undici = require("undici");

    const fetch = function (requestOrUrl, options) {
      if (typeof requestOrUrl === "string") {
        return fetch(new exports.Request(requestOrUrl, options));
      }
      return undici.fetch(requestOrUrl);
    };

    exports.fetch = fetch;
    exports.Headers = undici.Headers;

    const patchHeadersList = require("./patch-headers-list");
    const { HeadersList } = require('undici/lib/fetch/headers');
    patchHeadersList(HeadersList);

    const streams = require("stream");

    exports.Request = function Request(requestOrUrl, options) {
      if (typeof requestOrUrl === "string") {
        options = options || {};
        options.headers = new exports.Headers(options.headers || {});
        options.headers.delete("connection");
        if (options.body instanceof streams.Readable) {
          const readable = options.body;
          options.body = new exports.ReadableStream({
            start(controller) {
              readable.on('data', chunk => {
                controller.enqueue(chunk)
              })
              readable.on('end', () => {
                controller.close()
              })
            }
          })
        }
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
    exports.File = undici.File
    addFormDataToRequest(undici.Request, undici.File, undici.FormData);
  } else {
    const nodeFetch = require("node-fetch");
    const realFetch = nodeFetch.default || nodeFetch;

    const fetch = function (requestOrUrl, options) {
      if (typeof requestOrUrl === "string") {
        return fetch(new exports.Request(requestOrUrl, options));
      }
      return realFetch(requestOrUrl);
    };

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
        if (options.body instanceof exports.ReadableStream) {
          options.body = streams.Readable.from(options.body);
        }
        return new nodeFetch.Request(requestOrUrl, options);
      }
      return requestOrUrl.clone();
    };
    exports.Response = function Response(body, init) {
      if (body instanceof exports.ReadableStream) {
        const actualBody = streams.Readable.from(body);
        // Polyfill ReadableStream is not working well with node-fetch's Response
        return new nodeFetch.Response(actualBody, init);
      }
      return new nodeFetch.Response(body, init);
    };

    const formDataModule = require("formdata-node");
    exports.FormData = formDataModule.FormData
    exports.File = formDataModule.File
    addFormDataToRequest(nodeFetch.Request, formDataModule.File, formDataModule.FormData);
  }
}
