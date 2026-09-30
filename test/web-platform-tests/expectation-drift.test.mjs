import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyPassingImprovements, classifySuccessDrift } from './wpt-runner.mjs';

describe('WPT expectation drift', () => {
  it('treats an expected failure that now passes as an improvement', () => {
    const oldTree = {
      fetch: {
        api: {
          'redirect.any.html': {
            success: true,
            cases: {
              'cross origin / redirect': { success: false },
              'same origin': { success: false },
            },
          },
        },
      },
    };
    const newTree = {
      fetch: {
        api: {
          'redirect.any.html': {
            success: true,
            cases: {
              'cross origin / redirect': { success: true },
              'same origin': { success: false },
            },
          },
        },
      },
    };

    const drift = classifySuccessDrift(oldTree, newTree);

    assert.deepEqual(drift.regressions, []);
    assert.deepEqual(drift.improvements, [
      ['fetch', 'api', 'redirect.any.html', 'cases', 'cross origin / redirect'],
    ]);

    const patched = applyPassingImprovements(
      {
        fetch: {
          api: {
            'redirect.any.html': {
              success: true,
              cases: [
                {
                  name: 'cross origin / redirect',
                  success: false,
                  message: 'assert_equals: expected "none" but got "Basic"',
                },
                {
                  name: 'same origin',
                  success: false,
                  message: 'still failing',
                },
              ],
            },
          },
        },
      },
      drift.improvements,
    );

    assert.deepEqual(patched.fetch.api['redirect.any.html'].cases, [
      { name: 'cross origin / redirect', success: true },
      { name: 'same origin', success: false, message: 'still failing' },
    ]);
  });

  it('keeps a passing case that starts failing as a regression', () => {
    const drift = classifySuccessDrift(
      { file: { success: true, cases: { keep: { success: true } } } },
      { file: { success: true, cases: { keep: { success: false } } } },
    );

    assert.deepEqual(drift.improvements, []);
    assert.equal(drift.regressions.length, 1);
  });

  it('does not auto-accept a newly added case', () => {
    const drift = classifySuccessDrift(
      { file: { cases: {} } },
      { file: { cases: { fresh: { success: true } } } },
    );

    assert.deepEqual(drift.improvements, []);
    assert.equal(drift.regressions.length, 1);
  });
});
