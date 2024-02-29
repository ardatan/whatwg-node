// @ts-check

import http from 'k6/http';
import { Trend } from 'k6/metrics';

const scenario = __ENV.SCENARIO;
if (!scenario) {
  throw new Error('SCENARIO env var not defined, see scenarios.ts for available scenarios');
}

/** @type{import('k6/options').Options} */
export const options = {
  scenarios: {
    [scenario]: {
      executor: 'constant-vus',
      vus: 100,
      duration: '30s',
      gracefulStop: '0s',
    },
  },
};

const activeHandles = new Trend('active_handles');

export default function () {
  http.get(`http://localhost:50001/scenarios/${scenario}`);

  const res = http.get(`http://localhost:50001/activeHandles`);
  activeHandles.add(parseInt(String(res.body)));
}
