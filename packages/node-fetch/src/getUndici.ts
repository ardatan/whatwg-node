import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Agent, request } from 'undici';

export type UndiciModule = {
  request: typeof request;
  Agent: typeof Agent;
};

const DISABLE_KEY = Symbol.for('whatwg-node.disable-undici');
const LEGACY_DISPATCHER = Symbol.for('undici.globalDispatcher.1');

let cached: UndiciModule | null | undefined;

function createRequireFromCwd() {
  // Avoid `import.meta.url` so Jest's CJS transform keeps working.
  return createRequire(pathToFileURL(path.join(process.cwd(), '_')).href);
}

/**
 * Prefer loading Agent/request without executing `undici`'s index.js.
 * The package entry calls `setGlobalDispatcher` and overwrites
 * `Symbol.for('undici.globalDispatcher.1')`, which breaks Node's built-in `fetch`
 * when the bundled and npm undici versions disagree (e.g. content-length checks).
 */
function loadUndiciSideEffectFree(require: NodeRequire): UndiciModule {
  const undiciRoot = path.dirname(require.resolve('undici/package.json'));
  const Dispatcher = require(path.join(undiciRoot, 'lib/dispatcher/dispatcher.js'));
  const api = require(path.join(undiciRoot, 'lib/api/index.js'));
  Object.assign(Dispatcher.prototype, api);
  const AgentCtor = require(path.join(undiciRoot, 'lib/dispatcher/agent.js')) as typeof Agent;
  const util = require(path.join(undiciRoot, 'lib/core/util.js')) as {
    parseURL: (url: string | URL | object) => URL;
  };
  const { InvalidArgumentError } = require(path.join(undiciRoot, 'lib/core/errors.js')) as {
    InvalidArgumentError: new (message: string) => Error;
  };

  const requestFn: typeof request = ((url, opts: any = {}) => {
    if (opts.agent) {
      throw new InvalidArgumentError('unsupported opts.agent. Did you mean opts.dispatcher?');
    }
    const { dispatcher, ...restOpts } = opts;
    if (!dispatcher || typeof dispatcher.request !== 'function') {
      throw new InvalidArgumentError('opts.dispatcher is required');
    }
    const parsed = util.parseURL(url);
    return dispatcher.request({
      ...restOpts,
      origin: parsed.origin,
      path: parsed.search ? `${parsed.pathname}${parsed.search}` : parsed.pathname,
      method: restOpts.method || (restOpts.body ? 'PUT' : 'GET'),
    });
  }) as typeof request;

  return {
    Agent: AgentCtor,
    request: requestFn,
  };
}

function loadUndiciWithRestore(require: NodeRequire): UndiciModule {
  const prevLegacy = (globalThis as Record<symbol, unknown>)[LEGACY_DISPATCHER];
  const undici = require('undici') as UndiciModule;
  if (prevLegacy !== undefined) {
    (globalThis as Record<symbol, unknown>)[LEGACY_DISPATCHER] = prevLegacy;
  }
  return {
    Agent: undici.Agent,
    request: undici.request,
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
