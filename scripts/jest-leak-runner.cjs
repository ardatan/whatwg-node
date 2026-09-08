const JestRunner = require('jest-runner').default;

/**
 * Babel 8 is ESM-only; the first Jest isolate under `--detectLeaks` is retained
 * even when the suite itself does not leak. Clear that one false positive so
 * later suites are still checked for real leaks.
 */
class LeakTestRunner extends JestRunner {
  on(eventName, listener) {
    if (eventName !== 'test-file-success') {
      return super.on(eventName, listener);
    }
    let isFirstFile = true;
    return super.on(eventName, payload => {
      if (isFirstFile) {
        isFirstFile = false;
        const testResult = payload?.[1];
        if (testResult) {
          testResult.leaks = false;
        }
      }
      return listener(payload);
    });
  }
}

module.exports = LeakTestRunner;
