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
    `!#!#!#${JSON.stringify({ error: { stack: reason?.stack, message: reason?.message } })}\n`,
  );
  process.exitCode = 1;
});

process.on('unhandledRejection', reason => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  process.stderr.write(
    `!#!#!#${JSON.stringify({ error: { stack: err.stack, message: err.message } })}\n`,
  );
  process.exitCode = 1;
});

/** True when `ch` ends an HTML tag name (so `<script>` matches but `<scripture>` does not). */
function isHtmlTagNameBoundary(ch) {
  return ch === undefined || !/[a-z0-9]/i.test(ch);
}

/**
 * Find the next occurrence of an HTML tag name starting at `from`.
 * `needle` is lowercase and includes the leading `<` / `</` (e.g. `<script`, `</template`).
 */
function indexOfHtmlTag(lower, needle, from) {
  let cursor = from;
  while (cursor < lower.length) {
    const idx = lower.indexOf(needle, cursor);
    if (idx === -1) {
      return -1;
    }
    if (isHtmlTagNameBoundary(lower[idx + needle.length])) {
      return idx;
    }
    cursor = idx + needle.length;
  }
  return -1;
}

/**
 * Collect executable classic scripts in document order.
 * Skips HTML comments and inert `<template>` trees; validates open/close tag-name boundaries
 * (avoids treating `</scripture>` as a script closer). Index/scan only — no HTML-tag regexes.
 */
function collectClassicScripts(body) {
  /** @type {{ openTag: string; content: string }[]} */
  const scripts = [];
  const lower = body.toLowerCase();
  let cursor = 0;
  let templateDepth = 0;

  while (cursor < body.length) {
    const commentIdx = lower.indexOf('<!--', cursor);
    const templateOpenIdx = indexOfHtmlTag(lower, '<template', cursor);
    const templateCloseIdx = indexOfHtmlTag(lower, '</template', cursor);
    const scriptOpenIdx = indexOfHtmlTag(lower, '<script', cursor);

    const next = [
      commentIdx === -1 ? Infinity : commentIdx,
      templateOpenIdx === -1 ? Infinity : templateOpenIdx,
      templateCloseIdx === -1 ? Infinity : templateCloseIdx,
      scriptOpenIdx === -1 ? Infinity : scriptOpenIdx,
    ];
    const min = Math.min(...next);
    if (min === Infinity) {
      break;
    }

    if (min === commentIdx) {
      const end = lower.indexOf('-->', commentIdx + 4);
      cursor = end === -1 ? body.length : end + 3;
      continue;
    }

    if (min === templateOpenIdx) {
      const openEnd = body.indexOf('>', templateOpenIdx);
      if (openEnd === -1) {
        break;
      }
      templateDepth++;
      cursor = openEnd + 1;
      continue;
    }

    if (min === templateCloseIdx) {
      const closeEnd = body.indexOf('>', templateCloseIdx);
      if (closeEnd === -1) {
        break;
      }
      if (templateDepth > 0) {
        templateDepth--;
      }
      cursor = closeEnd + 1;
      continue;
    }

    // `<script ...>`
    const openEnd = body.indexOf('>', scriptOpenIdx);
    if (openEnd === -1) {
      break;
    }

    let closeIdx = indexOfHtmlTag(lower, '</script', openEnd + 1);
    // Closing tags inside comments should not terminate the script element.
    while (closeIdx !== -1) {
      const priorComment = lower.lastIndexOf('<!--', closeIdx);
      const priorCommentEnd = lower.lastIndexOf('-->', closeIdx);
      const insideComment = priorComment !== -1 && priorComment > priorCommentEnd;
      if (!insideComment) {
        break;
      }
      closeIdx = indexOfHtmlTag(lower, '</script', closeIdx + '</script'.length);
    }

    if (closeIdx === -1) {
      break;
    }

    const closeEnd = body.indexOf('>', closeIdx);
    if (closeEnd === -1) {
      break;
    }

    if (templateDepth === 0) {
      scripts.push({
        openTag: body.slice(scriptOpenIdx, openEnd + 1),
        content: body.slice(openEnd + 1, closeIdx),
      });
    }

    cursor = closeEnd + 1;
  }

  return scripts;
}

async function generateAndRunBundle(url) {
  const response = await fetch(url);
  const body = await response.text();

  /** @type {{ url?: URL; content: string }[]} */
  const scripts = [];

  for (const { openTag, content } of collectClassicScripts(body)) {
    const srcMatch = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(openTag);
    if (srcMatch) {
      const src = srcMatch[1] ?? srcMatch[2] ?? srcMatch[3];
      try {
        const scriptUrl = new URL(src, url);
        log(`Loading script: ${scriptUrl}`);
        const scriptResponse = await fetch(scriptUrl);
        if (!scriptResponse.ok) {
          throw new Error(`Failed to load script ${scriptUrl}: HTTP ${scriptResponse.status}`);
        }
        scripts.push({ url: scriptUrl, content: await scriptResponse.text() });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(
          `!#!#!#${JSON.stringify({ error: { message, stack: err?.stack } })}\n`,
        );
        process.exit(1); // eslint-disable-line n/no-process-exit
      }
    } else if (content.trim()) {
      scripts.push({ content });
    }
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

generateAndRunBundle(testUrl).catch(err => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`!#!#!#${JSON.stringify({ error: { message, stack: err?.stack } })}\n`);
  process.exit(1); // eslint-disable-line n/no-process-exit
});
