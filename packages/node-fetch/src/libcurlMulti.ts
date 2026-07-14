type LibcurlMulti = {
  close: () => void;
};

let sharedMulti: LibcurlMulti | null = null;

/**
 * Prefer an app-owned Multi over node-libcurl's process-default one so we can
 * dispose it (including CloseTimerAsync under Jest --detectLeaks).
 */
export function getLibcurlMulti(): LibcurlMulti {
  if (!sharedMulti) {
    const { Multi } = globalThis.libcurl;
    sharedMulti = new Multi();
  }
  return sharedMulti;
}

export function disposeLibcurlMulti(): void {
  if (!sharedMulti) {
    return;
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
}
