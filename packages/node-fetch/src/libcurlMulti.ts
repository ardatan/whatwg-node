type LibcurlMulti = {
  close: () => void;
  getCount: () => number;
};

const STATE_KEY = Symbol.for('@whatwg-node/node-fetch.libcurlMulti');

type SharedState = {
  multi: LibcurlMulti | null;
};

function getState(): SharedState {
  const globalState = globalThis as typeof globalThis & {
    [STATE_KEY]?: SharedState;
  };
  if (!globalState[STATE_KEY]) {
    globalState[STATE_KEY] = { multi: null };
  }
  return globalState[STATE_KEY];
}

/**
 * Prefer an app-owned Multi over node-libcurl's process-default one so we can
 * dispose it (including CloseTimerAsync under Jest --detectLeaks).
 *
 * State is stored on globalThis so Jest/CJS/ESM duplicate module instances
 * still share one Multi.
 */
export function getLibcurlMulti(): LibcurlMulti {
  const state = getState();
  if (!state.multi) {
    const { Multi } = globalThis.libcurl;
    state.multi = new Multi() as LibcurlMulti;
  }
  return state.multi as LibcurlMulti;
}

export function hasLibcurlMulti(): boolean {
  return getState().multi != null;
}

export async function disposeLibcurlMulti(): Promise<void> {
  const state = getState();
  if (!state.multi) {
    if (process.env.LEAK_TEST) {
       
      console.error('[disposeLibcurlMulti] sharedMulti was null');
    }
    return;
  }
  // Easy handles are removed from Multi via setImmediate (libcurl 8.17+);
  // wait until the pool is empty before curl_multi_cleanup.
  for (let i = 0; i < 50; i++) {
    if (state.multi.getCount() === 0) {
      break;
    }
    await new Promise<void>(resolve => setImmediate(resolve));
  }
  const pending = state.multi.getCount();
  if (process.env.LEAK_TEST) {
     
    console.error(`[disposeLibcurlMulti] disposing Multi with getCount=${pending}`);
  }
  const multi = state.multi;
  state.multi = null;
  try {
    multi.close();
  } catch {
    // already closed
  }
  const releaseTimer = (
    globalThis as typeof globalThis & {
      __whatwgNodeReleaseLibcurlMultiTimer?: (multi: LibcurlMulti) => void;
    }
  ).__whatwgNodeReleaseLibcurlMultiTimer;
  if (!releaseTimer) {
    throw new Error(
      'disposeLibcurlMulti: globalThis.__whatwgNodeReleaseLibcurlMultiTimer is not set',
    );
  }
  releaseTimer(multi);
  // Let uv_close's Unref callback run before Jest's leak detector runs GC.
  for (let i = 0; i < 20; i++) {
    await new Promise<void>(resolve => setImmediate(resolve));
  }
  await new Promise<void>(resolve => {
    globalThis.setTimeout(resolve, 50);
  });
}
