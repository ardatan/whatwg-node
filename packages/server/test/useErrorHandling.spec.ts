import { createServerAdapter } from '../src/createServerAdapter.js';
import { useErrorHandling } from '../src/plugins/useErrorHandling.js';

describe('useErrorHandling', () => {
  it('should return 500 when error is thrown', async () => {
    const router = createServerAdapter(
      () => {
        throw new Error('Unexpected error');
      },
      {
        plugins: [useErrorHandling()],
      },
    );
    const response = await router.fetch('http://localhost/greetings/John');
    expect(response.status).toBe(500);
    expect(response.statusText).toBe('Internal Server Error');
    const text = await response.text();
    expect(text).toHaveLength(0);
  });
});
