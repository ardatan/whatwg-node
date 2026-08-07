import { Readable } from 'node:stream';

type CleanupEntry = {
  stream: Readable;
  consumed: boolean;
};

/**
 * When a fetch Response is dropped without reading the body, Node's
 * IncomingMessage (or curl stream) stays paused and holds the socket.
 * Identity PassThrough used to eagerly pull bytes; without it we release the
 * underlying readable once the Response is garbage-collected.
 */
const unusedBodyRegistry = new FinalizationRegistry<CleanupEntry>(entry => {
  if (entry.consumed) {
    return;
  }
  entry.consumed = true;
  const { stream } = entry;
  if (!stream.destroyed) {
    // resume() discards unread data and lets IncomingMessage end so the
    // keep-alive socket can return to the agent pool. Avoid destroy() here —
    // it tears down the socket and breaks subsequent requests on the agent.
    stream.resume();
  }
});

/**
 * Track `stream` as the unused-body resource owned by `holder` (typically the
 * Response). Returns a function that marks the body consumed so GC cleanup is
 * skipped (call when the body is actually read).
 *
 * Important: do not attach a 'data' listener here — that would switch the
 * IncomingMessage into flowing mode and discard bytes before the consumer reads.
 */
export function trackUnusedBody(holder: object, stream: Readable): () => void {
  const entry: CleanupEntry = { stream, consumed: false };

  const markConsumed = () => {
    if (entry.consumed) {
      return;
    }
    entry.consumed = true;
    unusedBodyRegistry.unregister(entry);
    stream.removeListener('newListener', onNewListener);
    stream.removeListener('end', markConsumed);
  };

  function onNewListener(event: string | symbol) {
    // Consumer (or Body.collect) is about to read — untrack before flowing starts.
    if (event === 'data') {
      markConsumed();
    }
  }

  stream.on('newListener', onNewListener);
  // If the stream ends without a data listener (e.g. empty body), untrack.
  stream.once('end', markConsumed);

  unusedBodyRegistry.register(holder, entry, entry);
  return markConsumed;
}
