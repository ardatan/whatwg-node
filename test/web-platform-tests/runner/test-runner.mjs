// Copyright 2018-2025 the Deno authors. MIT license.
// Adapted from nodejs/undici for @whatwg-node/node-fetch.

import { debuglog } from 'node:util';
import { runInThisContext } from 'node:vm';
import {
  Blob,
  btoa,
  CompressionStream,
  DecompressionStream,
  fetch,
  File,
  FormData,
  Headers,
  ReadableStream,
  Request,
  Response,
  TextDecoder,
  TextDecoderStream,
  TextEncoder,
  TextEncoderStream,
  TransformStream,
  URL,
  URLSearchParams,
  WritableStream,
} from '@whatwg-node/node-fetch';

const globalPropertyDescriptors = {
  writable: true,
  enumerable: false,
  configurable: true,
};

Object.defineProperties(globalThis, {
  fetch: {
    ...globalPropertyDescriptors,
    enumerable: true,
    value: fetch,
  },
  FormData: {
    ...globalPropertyDescriptors,
    value: FormData,
  },
  Headers: {
    ...globalPropertyDescriptors,
    value: Headers,
  },
  Request: {
    ...globalPropertyDescriptors,
    value: Request,
  },
  Response: {
    ...globalPropertyDescriptors,
    value: Response,
  },
  Blob: {
    ...globalPropertyDescriptors,
    value: Blob,
  },
  File: {
    ...globalPropertyDescriptors,
    value: File,
  },
  ReadableStream: {
    ...globalPropertyDescriptors,
    value: ReadableStream,
  },
  WritableStream: {
    ...globalPropertyDescriptors,
    value: WritableStream,
  },
  TransformStream: {
    ...globalPropertyDescriptors,
    value: TransformStream,
  },
  CompressionStream: {
    ...globalPropertyDescriptors,
    value: CompressionStream,
  },
  DecompressionStream: {
    ...globalPropertyDescriptors,
    value: DecompressionStream,
  },
  TextEncoder: {
    ...globalPropertyDescriptors,
    value: TextEncoder,
  },
  TextDecoder: {
    ...globalPropertyDescriptors,
    value: TextDecoder,
  },
  TextEncoderStream: {
    ...globalPropertyDescriptors,
    value: TextEncoderStream,
  },
  TextDecoderStream: {
    ...globalPropertyDescriptors,
    value: TextDecoderStream,
  },
  URL: {
    ...globalPropertyDescriptors,
    value: URL,
  },
  URLSearchParams: {
    ...globalPropertyDescriptors,
    value: URLSearchParams,
  },
  btoa: {
    ...globalPropertyDescriptors,
    value: btoa,
  },
});

const log = debuglog('WHATWG_NODE_WPT');
const testUrl = process.argv[2];

// Set up environment
globalThis.window = globalThis.self = globalThis;
globalThis.location = new URL(testUrl);
globalThis.Window = Object.getPrototypeOf(globalThis).constructor;

function setupGlobalTestharnessCallbacks() {
  const cases = [];

  globalThis.add_result_callback(({ index, message, name, stack, status }) => {
    cases.push({ index, name, status, message, stack });
  });

  globalThis.add_completion_callback((_tests, harnessStatus) => {
    process.stdout.end('#$#$#' + JSON.stringify({ tests: cases, harnessStatus }) + '\n', () => {
      process.stdout._flush?.();

      if (process.platform === 'win32') {
        // https://github.com/nodejs/node/issues/56645#issuecomment-3077594952
        setTimeout(() => {
          // eslint-disable-next-line n/no-process-exit
          process.exit(harnessStatus.status === 0 ? 0 : 1);
        }, 50);
      } else {
        // eslint-disable-next-line n/no-process-exit
        process.exit(harnessStatus.status === 0 ? 0 : 1);
      }
    });
  });
}

process.on('uncaughtException', reason => {
  process.stderr.write(
    `!#!#!#${JSON.stringify({ error: { stack: reason.stack, message: reason.message } })}\n`,
  );
});

process.on('unhandledRejection', reason => {
  process.stderr.write(
    `!#!#!#${JSON.stringify({ error: { stack: reason.stack, message: reason.message } })}\n`,
  );
});

async function generateAndRunBundle(url) {
  const response = await fetch(url);
  const body = await response.text();

  // Scripts may have src tags without being enclosed in quotes.
  // Case-insensitive; allow whitespace before the closing `>` (e.g. `</script >`).
  const scriptSrcRegex = /<script\b[^>]*\bsrc=["']?([^"'\s>]+)["']?[^>]*>\s*<\/script\s*>/gi;
  const inlineScriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;

  /** @type {{ url?: URL; content: string }[]} */
  const scripts = [];

  let match;
  while ((match = scriptSrcRegex.exec(body)) !== null) {
    const src = match[1];

    try {
      const scriptUrl = new URL(src, url);
      log(`Loading script: ${scriptUrl}`);
      const scriptResponse = await fetch(scriptUrl);
      if (scriptResponse.ok) {
        const scriptContent = await scriptResponse.text();
        scripts.push({ url: scriptUrl, content: scriptContent });
      }
    } catch {
      console.warn(`Failed to load script: ${src}`);
    }
  }

  while ((match = inlineScriptRegex.exec(body)) !== null) {
    const scriptContent = match[1];
    scripts.push({ content: scriptContent });
  }

  log(`Loaded ${scripts.length} scripts`);

  for (let i = 0; i < scripts.length; i++) {
    log(`Executing script ${i + 1}/${scripts.length}`);
    runInThisContext(scripts[i].content);

    if (scripts[i].url?.pathname === '/resources/testharness.js') {
      setupGlobalTestharnessCallbacks();
    }
  }

  log('All scripts executed');
}

generateAndRunBundle(testUrl);
