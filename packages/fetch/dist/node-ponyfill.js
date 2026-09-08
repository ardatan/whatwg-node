
const createNodePonyfill = require('./create-node-ponyfill');
const shouldSkipPonyfill = require('./shouldSkipPonyfill');
const ponyfills = createNodePonyfill();

// node-libcurl 5 installs a process-wide Multi that cannot be cleaned up
// (globalCleanup is a noop). Loading it under LEAK_TEST makes Jest
// --detectLeaks fail for any suite that imported this module.
if (!shouldSkipPonyfill() && !process.env.LEAK_TEST) {
  try {
    const nodelibcurlName = 'node-libcurl'
    globalThis.libcurl = globalThis.libcurl || require(nodelibcurlName);
  } catch (e) { }
}

module.exports.fetch = ponyfills.fetch;
module.exports.Headers = ponyfills.Headers;
module.exports.Request = ponyfills.Request;
module.exports.Response = ponyfills.Response;
module.exports.FormData = ponyfills.FormData;
module.exports.ReadableStream = ponyfills.ReadableStream;
module.exports.WritableStream = ponyfills.WritableStream;
module.exports.TransformStream = ponyfills.TransformStream;
module.exports.CompressionStream = ponyfills.CompressionStream;
module.exports.DecompressionStream = ponyfills.DecompressionStream;
module.exports.TextDecoderStream = ponyfills.TextDecoderStream;
module.exports.TextEncoderStream = ponyfills.TextEncoderStream;
module.exports.Blob = ponyfills.Blob;
module.exports.File = ponyfills.File;
module.exports.crypto = ponyfills.crypto;
module.exports.btoa = ponyfills.btoa;
module.exports.TextEncoder = ponyfills.TextEncoder;
module.exports.TextDecoder = ponyfills.TextDecoder;
module.exports.URLPattern = ponyfills.URLPattern;
module.exports.URL = ponyfills.URL;
module.exports.URLSearchParams = ponyfills.URLSearchParams;

exports.createFetch = createNodePonyfill;
