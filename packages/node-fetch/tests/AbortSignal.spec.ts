import { PonyfillAbortSignal } from "../src/AbortSignal";

describe('AbortSignal', () => {
    it('timeout', done => {
        expect.assertions(1);
        const start = Date.now();
        const signal = PonyfillAbortSignal.timeout(600);
        signal.onabort = () => {
            const end = Date.now();
            expect(end - start).toBeGreaterThanOrEqual(600);
            done();
        }
    })
})