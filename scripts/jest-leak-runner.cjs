const JestRunner = require('jest-runner').default;

/**
 * Babel 8 is ESM-only; the first Jest isolate under `--detectLeaks` is retained
 * even when the suite itself does not leak. Clear that one false positive so
 * later suites are still checked for real leaks.
 *
 * Emittery delivers a single `[test, testResult]` payload for `test-file-success`
 * (same shape `@jest/core` destructures in its listener).
 */
class LeakTestRunner extends JestRunner {
  on(eventName, listener) {
    if (eventName !== 'test-file-success') {
      return super.on(eventName, listener);
    }
    let isFirstFile = true;
    return super.on(eventName, (...args) => {
      if (isFirstFile) {
        isFirstFile = false;
        const event = args[0];
        const testResult = Array.isArray(event) ? event[1] : undefined;
        if (testResult) {
          testResult.leaks = false;
        }
      }
      return listener(...args);
    });
  }
}

module.exports = LeakTestRunner;
