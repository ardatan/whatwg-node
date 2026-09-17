import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Agent, Dispatcher } from 'undici';

export type UndiciModule = {
  Agent: typeof Agent;
  parseURL: (url: string | URL | object) => URL;
};

const DISABLE_KEY = Symbol.for('whatwg-node.disable-undici');
const LEGACY_DISPATCHER = Symbol.for('undici.globalDispatcher.1');

let cached: UndiciModule | null | undefined;

function createRequireFromCwd() {
  // Avoid `import.meta.url` so Jest's CJS transform keeps working.
  return createRequire(pathToFileURL(path.join(process.cwd(), '_')).href);
}

/**
 * Prefer loading Agent without executing `undici`'s index.js.
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
  };
}

function loadUndiciWithRestore(require: NodeRequire): UndiciModule {
  const prevLegacy = (globalThis as Record<symbol, unknown>)[LEGACY_DISPATCHER];
  const undici = require('undici') as { Agent: typeof Agent };
  if (prevLegacy !== undefined) {
    (globalThis as Record<symbol, unknown>)[LEGACY_DISPATCHER] = prevLegacy;
  }
  // parseURL is not public on the package entry; fall back to WHATWG URL.
  return {
    Agent: undici.Agent,
    parseURL: (url: string | URL | object) =>
      typeof url === 'string' || url instanceof URL ? new URL(url as string | URL) : new URL(String(url)),
  };
}

function loadUndici(): UndiciModule | null {
  if (cached !== undefined) {
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
 * Optional `undici` transport. Tests can force the `node:http` path with
 * `globalThis[Symbol.for('whatwg-node.disable-undici')] = true`.
 */
export function getUndici(): UndiciModule | null {
  if ((globalThis as Record<symbol, unknown>)[DISABLE_KEY]) {
    return null;
  }
  return loadUndici();
}

export type { Dispatcher };
