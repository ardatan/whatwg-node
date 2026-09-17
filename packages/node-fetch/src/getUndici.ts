import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Agent, Dispatcher } from 'undici';

export type UndiciInterceptors = {
  redirect: (opts?: { maxRedirections?: number }) => Dispatcher.DispatcherComposeInterceptor;
  decompress: (opts?: Record<string, unknown>) => Dispatcher.DispatcherComposeInterceptor;
  dns: (opts?: { maxTTL?: number; dualStack?: boolean }) => Dispatcher.DispatcherComposeInterceptor;
};

export type UndiciModule = {
  Agent: typeof Agent;
  parseURL: (url: string | URL | object) => URL;
  interceptors: UndiciInterceptors;
};

const DISABLE_KEY = Symbol.for('whatwg-node.disable-undici');
const LEGACY_DISPATCHER = Symbol.for('undici.globalDispatcher.1');

let cached: UndiciModule | null | undefined;

function createRequireFromCwd() {
  // Avoid `import.meta.url` so Jest's CJS transform keeps working.
  return createRequire(pathToFileURL(path.join(process.cwd(), '_')).href);
}

function loadInterceptors(require: NodeRequire, undiciRoot: string): UndiciInterceptors {
  return {
    redirect: require(path.join(undiciRoot, 'lib/interceptor/redirect.js')),
    decompress: require(path.join(undiciRoot, 'lib/interceptor/decompress.js')),
    dns: require(path.join(undiciRoot, 'lib/interceptor/dns.js')),
  };
}

/**
 * Prefer loading Agent/interceptors without executing `undici`'s index.js.
 * The package entry calls `setGlobalDispatcher` and overwrites
 * `Symbol.for('undici.globalDispatcher.1')`, which breaks Node's built-in `fetch`
 * when the bundled and npm undici versions disagree (e.g. content-length checks).
 */
function loadUndiciSideEffectFree(require: NodeRequire): UndiciModule {
  const undiciRoot = path.dirname(require.resolve('undici/package.json'));
  const AgentCtor = require(path.join(undiciRoot, 'lib/dispatcher/agent.js')) as typeof Agent;
  const util = require(path.join(undiciRoot, 'lib/core/util.js')) as {
    parseURL: (url: string | URL | object) => URL;
  };
  return {
    Agent: AgentCtor,
    parseURL: util.parseURL.bind(util),
    interceptors: loadInterceptors(require, undiciRoot),
  };
}

function loadUndiciWithRestore(require: NodeRequire): UndiciModule {
  const prevLegacy = (globalThis as Record<symbol, unknown>)[LEGACY_DISPATCHER];
  // Optional soft-require (same idea as the old libcurl path); not a hard dependency.
  // eslint-disable-next-line import/no-extraneous-dependencies -- optional runtime transport
  const undici = require('undici') as {
    Agent: typeof Agent;
    interceptors: UndiciInterceptors;
  };
  if (prevLegacy !== undefined) {
    (globalThis as Record<symbol, unknown>)[LEGACY_DISPATCHER] = prevLegacy;
  }
  return {
    Agent: undici.Agent,
    parseURL: (url: string | URL | object) =>
      typeof url === 'string' || url instanceof URL
        ? new URL(url as string | URL)
        : new URL(String(url)),
    interceptors: undici.interceptors,
  };
}

function loadUndici(): UndiciModule | null {
  if (cached !== undefined) {
    return cached;
  }
  // Bun / Deno already ship a solid native fetch; keep the optional undici
  // transport for Node only (mirrors the old libcurl skip on these runtimes).
  if (globalThis.Bun || globalThis.Deno) {
    cached = null;
    return cached;
  }
  try {
    const require = createRequireFromCwd();
    try {
      cached = loadUndiciSideEffectFree(require);
    } catch {
      cached = loadUndiciWithRestore(require);
    }
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * Optional `undici` transport on Node. Tests can force the `node:http` path with
 * `globalThis[Symbol.for('whatwg-node.disable-undici')] = true`,
 * `WHATWG_NODE_DISABLE_UNDICI=1`, or `LEAK_TEST=1` (shared Agent would otherwise
 * trip Jest leak detection).
 */
export function getUndici(): UndiciModule | null {
  if ((globalThis as Record<symbol, unknown>)[DISABLE_KEY]) {
    return null;
  }
  if (process.env.LEAK_TEST || process.env.WHATWG_NODE_DISABLE_UNDICI) {
    return null;
  }
  return loadUndici();
}

export type { Dispatcher };
