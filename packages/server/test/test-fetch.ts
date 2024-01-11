import { globalAgent as httpGlobalAgent } from 'node:http';
import { globalAgent as httpsGlobalAgent } from 'node:https';

const libcurl = globalThis.libcurl;
export function runTestsForEachFetchImpl(callback: (implementationName: string) => void) {
  if (libcurl) {
    describe('libcurl', () => {
      // eslint-disable-next-line n/no-callback-literal
      callback('libcurl');
    });
  }
  describe('node-http', () => {
    beforeAll(() => {
      (globalThis.libcurl as any) = null;
    });
    afterAll(() => {
      globalThis.libcurl = libcurl;
      httpGlobalAgent.destroy();
      httpsGlobalAgent.destroy();
    });
    // eslint-disable-next-line n/no-callback-literal
    callback('libcurl');
  });
}
