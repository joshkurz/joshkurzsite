import handler from '../../pages/api/hello';
import { createMocks } from 'node-mocks-http';

describe('GET /api/hello', () => {
  it('returns the expected name', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({ name: 'Josh Kurz' });
  });
});
