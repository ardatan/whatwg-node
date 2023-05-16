module.exports = function createNodePonyfill(opts = {}) {
  const ponyfills = {};
  
  // We call this previously to patch `Bun`
  if (!ponyfills.URLPattern) {
    const urlPatternModule = require('urlpattern-polyfill');
    ponyfills.URLPattern = urlPatternModule.URLPattern;
  }

  // Bun and Deno already have a Fetch API
  if (globalThis.Deno || process.versions.bun) {
    return globalThis;
  }

  const newNodeFetch = require('@whatwg-node/node-fetch');

  ponyfills.fetch = newNodeFetch.fetch;
  ponyfills.Request = newNodeFetch.Request;
  ponyfills.Response = newNodeFetch.Response;
  ponyfills.Headers = newNodeFetch.Headers;
  ponyfills.FormData = newNodeFetch.FormData;
  ponyfills.ReadableStream = newNodeFetch.ReadableStream;

  ponyfills.URL = newNodeFetch.URL;
  ponyfills.URLSearchParams = newNodeFetch.URLSearchParams;

  ponyfills.WritableStream = globalThis.WritableStream;
  ponyfills.TransformStream = globalThis.TransformStream;

  if (!ponyfills.WritableStream) {
    const streamsWeb = require("stream/web");
    ponyfills.WritableStream = streamsWeb.WritableStream;
    ponyfills.TransformStream = streamsWeb.TransformStream;
  }

  ponyfills.Blob = newNodeFetch.Blob;
  ponyfills.File = newNodeFetch.File;
  ponyfills.crypto = globalThis.crypto;
  ponyfills.btoa = newNodeFetch.btoa;
  ponyfills.TextEncoder = newNodeFetch.TextEncoder;
  ponyfills.TextDecoder = newNodeFetch.TextDecoder;

  if (opts.formDataLimits) {
    ponyfills.Body = class Body extends newNodeFetch.Body {
      constructor(body, userOpts) {
        super(body, {
          formDataLimits: opts.formDataLimits,
          ...userOpts,
        });
      }
    }
    ponyfills.Request = class Request extends newNodeFetch.Request {
      constructor(input, userOpts) {
        super(input, {
          formDataLimits: opts.formDataLimits,
          ...userOpts,
        });
      }
    }
    ponyfills.Response = class Response extends newNodeFetch.Response {
      constructor(body, userOpts) {
        super(body, {
          formDataLimits: opts.formDataLimits,
          ...userOpts,
        });
      }
    }
  }

  if (!ponyfills.crypto) {
    const cryptoModule = require("crypto");
    ponyfills.crypto = cryptoModule.webcrypto;
  }

  return ponyfills;
}
