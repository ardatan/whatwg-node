const libcurl = globalThis.libcurl;
export function runTestsForEachFetchImpl(callback: () => void) {
  if (!libcurl) {
    describe('libcurl', () => {
      callback();
    });
  }
  describe('node-http', () => {
    beforeAll(() => {
      (globalThis.libcurl as any) = null;
    });
    afterAll(() => {
      globalThis.libcurl = libcurl;
    });
    callback();
  });
}
