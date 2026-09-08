const JestRunner = require('jest-runner').default;

/**
 * Babel 8 is ESM-only; the first Jest isolate under `--detectLeaks` is retained
 * even when the suite itself does not leak. Clear that false positive only for
 * the disposable warmup suite so later suites are still checked for real leaks.
 *
 * Emittery delivers a single `[test, testResult]` payload for `test-file-success`
 * (same shape `@jest/core` destructures). Defend against positional args too.
 */
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
