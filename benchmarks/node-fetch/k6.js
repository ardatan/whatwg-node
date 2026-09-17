// @ts-check

import http from 'k6/http';
import { Trend } from 'k6/metrics';
import { textSummary } from '../textSummary.js';
import { githubComment } from './lib.js';

const scenario = __ENV.SCENARIO;
if (!scenario) {
  throw new Error('SCENARIO env var not defined, see scenarios.ts for available scenarios');
}

const warmupIterations = 200;
const activeHandlesSampleDelay = '5s';

/** @type{import('k6/options').Options} */
export const options = {
  thresholds: {
    active_handles: ['p(95)<250'], // sustained active handles must stay below 250
  },
  scenarios: {
    [scenario]: {
      exec: 'runScenario',
      executor: 'constant-vus',
      vus: 100,
      duration: '30s',
      gracefulStop: '5s',
    },
    activeHandlesSampler: {
      exec: 'sampleActiveHandles',
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '1s',
      duration: '25s',
      startTime: activeHandlesSampleDelay,
      preAllocatedVUs: 1,
      maxVUs: 1,
    },
  },
};

const activeHandles = new Trend('active_handles');

export function setup() {
  for (let i = 0; i < warmupIterations; i++) {
    const res = http.get(`http://localhost:50001/scenarios/${scenario}`);
    if (res.status !== 200) {
      throw new Error(`Warmup request failed with status ${res.status}`);
    }
  }
}

export function runScenario() {
  http.get(`http://localhost:50001/scenarios/${scenario}`);
}

export function sampleActiveHandles() {
  const res = http.get('http://localhost:50001/activeHandles');
  activeHandles.add(parseInt(String(res.body), 10));
}

export function handleSummary(data) {
  if (__ENV.GITHUB_TOKEN) {
    githubComment(data, {
      token: __ENV.GITHUB_TOKEN,
      commit: __ENV.GITHUB_SHA,
      pr: __ENV.GITHUB_PR,
      org: 'ardatan',
      repo: 'whatwg-node',
      commentKey: `@benchmarks/node-fetch+${scenario}`,
      renderTitle({ passes }) {
        return passes
          ? `✅ \`@benchmarks/node-fetch\` results (${scenario})`
          : `❌ \`@benchmarks/node-fetch\` failed (${scenario})`;
      },
      renderMessage({ passes, checks, thresholds }) {
        const result = [];

        if (thresholds.failures) {
          result.push(`**Performance regression detected**`);
        }

        if (checks.failures) {
          result.push('**Failed assertions detected**');
        }

        if (!passes) {
          result.push(
            `> If the performance regression is expected, please increase the failing threshold.`,
          );
        }

        return result.join('\n');
      },
    });
  }
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
