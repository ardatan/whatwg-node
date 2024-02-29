import { fetchPonyfill as fetch } from '../../packages/node-fetch/src/fetch';

export const scenarios = {
  async noConsumeBody(url: string) {
    await fetch(url, {
      method: 'POST',
      body: '{ "hello": "world" }',
    });
  },
  async consumeBody(url: string) {
    const res = await fetch(url, {
      method: 'POST',
      body: '{ "hello": "world" }',
    });
    await res.json();
  },
} as const;

export function isScenario(str: unknown): str is keyof typeof scenarios {
  return typeof str === 'string' && str in scenarios;
}
