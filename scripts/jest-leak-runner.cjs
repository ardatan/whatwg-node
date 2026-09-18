const JestRunner = require('jest-runner').default;
const LeakDetector = require('jest-leak-detector').default;

/**
 * Babel 8 is ESM-only; the first Jest isolate under `--detectLeaks` is retained
 * even when the suite itself does not leak. Clear that false positive only for
 * the disposable warmup suite so later suites are still checked for real leaks.
 *
 * Emittery delivers a single `[test, testResult]` payload for `test-file-success`
 * (same shape `@jest/core` destructures). Defend against positional args too.
 *
 * After the Jest ALS/console patches, undici sockets can still briefly outlive
 * the ~100ms post-teardown window. Retry GC (no heap snapshots) a few times.
 */
const originalIsLeaking = LeakDetector.prototype.isLeaking;
LeakDetector.prototype.isLeaking = async function isLeakingWithUndiciSettle() {
  const prevSnapshot = this._shouldGenerateV8HeapSnapshot;
  this._shouldGenerateV8HeapSnapshot = false;
  try {
    for (let attempt = 0; attempt < 15; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      if (!(await originalIsLeaking.call(this))) {
        return false;
      }
    }
  } finally {
    this._shouldGenerateV8HeapSnapshot = prevSnapshot;
  }
  return originalIsLeaking.call(this);
};

class LeakTestRunner extends JestRunner {
  on(eventName, listener) {
    if (eventName !== 'test-file-success') {
      return super.on(eventName, listener);
    }
    return super.on(eventName, (...args) => {
      const event = args[0];
      const test = Array.isArray(event) ? event[0] : args[0];
      const testResult = Array.isArray(event) ? event[1] : args[1];
      if (
        testResult &&
        typeof test?.path === 'string' &&
        test.path.endsWith('leak-warmup.spec.ts')
      ) {
        testResult.leaks = false;
      }
      return listener(...args);
    });
  }
}

module.exports = LeakTestRunner;
