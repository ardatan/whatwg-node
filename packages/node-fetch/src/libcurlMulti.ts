type LibcurlMulti = {
  close: () => void;
  getCount: () => number;
};

let sharedMulti: LibcurlMulti | null = null;

/**
 * Prefer an app-owned Multi over node-libcurl's process-default one so we can
 * dispose it (including CloseTimerAsync under Jest --detectLeaks).
 */
export function getLibcurlMulti(): LibcurlMulti {
  if (!sharedMulti) {
    const { Multi } = globalThis.libcurl;
    sharedMulti = new Multi() as LibcurlMulti;
  }
  return sharedMulti as LibcurlMulti;
}

export async function disposeLibcurlMulti(): Promise<void> {
  if (!sharedMulti) {
    return;
  }
  // Easy handles are removed from Multi via setImmediate (libcurl 8.17+);
  // wait until the pool is empty before curl_multi_cleanup.
  for (let i = 0; i < 50; i++) {
    if (sharedMulti.getCount() === 0) {
      break;
    }
    await new Promise<void>(resolve => setImmediate(resolve));
  }
  const multi = sharedMulti;
  sharedMulti = null;
  try {
    multi.close();
  } catch {
    // already closed
  }
  // Optional monorepo helper: uv_close + ObjectWrap::Unref (CloseTimerAsync).
  const releaseTimer = (
    globalThis as typeof globalThis & {
      __whatwgNodeReleaseLibcurlMultiTimer?: (multi: LibcurlMulti) => void;
    }
  ).__whatwgNodeReleaseLibcurlMultiTimer;
  releaseTimer?.(multi);
  // Let uv_close's Unref callback run before Jest's leak detector runs GC.
  for (let i = 0; i < 20; i++) {
    await new Promise<void>(resolve => setImmediate(resolve));
  }
  await new Promise<void>(resolve => {
    globalThis.setTimeout(resolve, 50);
  });
}
