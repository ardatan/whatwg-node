/* eslint-disable */
import { textSummary } from 'k6/summary';
import { githubComment } from './lib.js';
import { check } from 'k6';
import http from 'k6/http';

export const options = {
  vus: 1,
  duration: '90s',
  thresholds: {
    checks: ['rate>0.98'],
  },
};

export function handleSummary(data) {
  if (__ENV.GITHUB_TOKEN) {
    githubComment(data, {
      token: __ENV.GITHUB_TOKEN,
      commit: __ENV.GITHUB_SHA,
      pr: __ENV.GITHUB_PR,
      org: 'ardatan',
      repo: 'whatwg-node',
      commentKey: `@benchmarks/server+${__ENV.SCENARIO}`,
      renderTitle({ passes }) {
        return passes
          ? `✅ \`@benchmarks/server\` results (${__ENV.SCENARIO})`
          : `❌ \`@benchmarks/server\` failed (${__ENV.SCENARIO})`;
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

const reqBody = JSON.stringify({
  name: 'World',
});

const reqParams = {
  headers: {
    'Content-Type': 'application/json',
  },
};

const reqUrl = `http://127.0.0.1:4000`;
const expectedStructure = { message: 'Hello, World!' };

let printIdentifiersMap = {};
let runIdentifiersMap = {};

function printOnce(identifier, ...args) {
  if (printIdentifiersMap[identifier]) {
    return;
  }

  console.log(...args);
  printIdentifiersMap[identifier] = true;
}

function runOnce(identifier, cb) {
  if (runIdentifiersMap[identifier]) {
    return true;
  }

  runIdentifiersMap[identifier] = true;
  return cb();
}

function checkResponseStructure(x) {
  function checkRecursive(obj, structure) {
    if (obj == null) {
      return false;
    }
    for (var key in structure) {
      if (!obj.hasOwnProperty(key) || typeof obj[key] !== typeof structure[key]) {
        return false;
      }
      if (typeof structure[key] === 'object' && structure[key] !== null) {
        if (!checkRecursive(obj[key], structure[key])) {
          return false;
        }
      }
    }
    return true;
  }
  return checkRecursive(x, expectedStructure);
}

export default function run() {
  const res = http.post(reqUrl, reqBody, reqParams);

  check(res, {
    'response code was 200': resp => resp.status === 200,
    'valid response structure': resp => {
      return runOnce('valid response structure', () => {
        const json = resp.json();

        let isValid = checkResponseStructure(json);

        if (!isValid) {
          printOnce('response_structure', `‼️ Got invalid structure, here's a sample:`, res.body);
        }

        return isValid;
      });
    },
  });
}
