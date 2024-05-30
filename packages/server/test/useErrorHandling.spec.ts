import { useErrorHandling } from '../src/plugins/useErrorHandling.js';
import { runTestsForEachFetchImpl } from './test-fetch.js';

describe('useErrorHandling', () => {
  runTestsForEachFetchImpl(
    (_, { createServerAdapter, fetchAPI }) => {
      it('should return 500 when error is thrown', async () => {
        const errorHandler = jest.fn();
        let request: Request | undefined;
        const router = createServerAdapter(
          req => {
            request = req;
            throw new Error('Unexpected error');
          },
          {
            plugins: [useErrorHandling(errorHandler)],
            fetchAPI,
          },
        );
        const response = await router.fetch('http://localhost/greetings/John');
        expect(response.status).toBe(500);
        expect(response.statusText).toBe('Internal Server Error');
        const text = await response.text();
        expect(text).toHaveLength(0);
        expect(errorHandler).toHaveBeenCalledWith(new Error('Unexpected error'), request, {});
      });
    },
    { noLibCurl: true },
  );
});
