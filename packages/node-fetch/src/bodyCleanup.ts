import { Readable } from 'node:stream';

type CleanupEntry = {
  stream: Readable;
  consumed: boolean;
  /** Live FinalizationRegistry owners (Response, body proxy, readers, …). */
  refCount: number;
  onNewListener: (event: string | symbol) => void;
  markConsumed: () => void;
};

const entriesByStream = new WeakMap<Readable, CleanupEntry>();

/**
 * When a fetch Response is dropped without reading the body, Node's
 * IncomingMessage (or curl stream) stays paused and holds the socket.
 * Identity PassThrough used to eagerly pull bytes; without it we release the
 * underlying readable once every tracked owner is garbage-collected.
 */
const unusedBodyRegistry = new FinalizationRegistry<CleanupEntry>(entry => {
  entry.refCount -= 1;
  if (entry.refCount > 0 || entry.consumed) {
    return;
  }
  entry.markConsumed();
  const { stream } = entry;
  if (!stream.destroyed) {
    // resume() discards unread data and lets IncomingMessage end so the
    // keep-alive socket can return to the agent pool. Avoid destroy() here —
    // it tears down the socket and breaks subsequent requests on the agent.
    stream.resume();
  }
});

function getOrCreateEntry(stream: Readable): CleanupEntry {
  const existing = entriesByStream.get(stream);
  if (existing) {
    return existing;
  }

  const entry: CleanupEntry = {
    stream,
    consumed: false,
    refCount: 0,
    onNewListener: () => {},
    markConsumed: () => {},
  };

  entry.markConsumed = () => {
    if (entry.consumed) {
      return;
    }
    entry.consumed = true;
    stream.removeListener('newListener', entry.onNewListener);
    stream.removeListener('end', entry.markConsumed);
    entriesByStream.delete(stream);
  };

  entry.onNewListener = (event: string | symbol) => {
    // Consumer (or Body.collect) is about to read — stop GC resume.
    // Do not attach a 'data' listener ourselves; that would discard bytes.
    if (event === 'data') {
      entry.markConsumed();
    }
  };

  entriesByStream.set(stream, entry);
  stream.on('newListener', entry.onNewListener);
  stream.once('end', entry.markConsumed);
  return entry;
}

/**
 * Track `stream` as owned by `holder` (Response, body proxy, reader, …).
 * The underlying readable is resumed only after the last owner is collected
 * and the body was never consumed.
 *
 * Returns a function that marks the body consumed so GC cleanup is skipped.
 */
export function trackUnusedBody(holder: object, stream: Readable): () => void {
  const entry = getOrCreateEntry(stream);
  entry.refCount += 1;
  unusedBodyRegistry.register(holder, entry);
  return entry.markConsumed;
}

/**
 * Add another live owner for an already-tracked stream (e.g. cached body proxy
 * or a ReadableStreamDefaultReader). No-op if the body is already consumed or
 * was never tracked.
 */
export function retainBodyOwner(holder: object, stream: Readable): void {
  const entry = entriesByStream.get(stream);
  if (!entry || entry.consumed) {
    return;
  }
  entry.refCount += 1;
  unusedBodyRegistry.register(holder, entry);
}

/**
 * Pull the response body in the background so keep-alive sockets are released
 * without waiting for GC. Identity PassThrough used to do this by buffering;
 * `PonyfillBody` coalesces concurrent reads onto the same `_chunks` promise, so
 * a later `json()` / `arrayBuffer()` still sees the drained bytes.
 */
export function ensureBodyDraining(response: { arrayBuffer(): Promise<ArrayBuffer> }): void {
  response.arrayBuffer().then(
    () => undefined,
    () => undefined,
  );
}
