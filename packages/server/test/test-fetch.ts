/* eslint-disable n/no-callback-literal */
import { globalAgent as httpGlobalAgent } from 'http';
import { globalAgent as httpsGlobalAgent } from 'https';

const libcurl = globalThis.libcurl;
export function runTestsForEachFetchImpl(callback: (implementationName: string) => void) {
  if (libcurl) {
    describe('libcurl', () => {
      callback('libcurl');
      afterAll(() => {
        libcurl.Curl.globalCleanup();
      });
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
    callback('node-http');
  });
  afterEach(() => {
    globalThis?.gc?.();
  });
}
