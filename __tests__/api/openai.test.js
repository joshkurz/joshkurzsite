import handler from '../../pages/api/openai';
import { createMocks } from 'node-mocks-http';

describe('GET /api/openai', () => {
  beforeAll(() => {
    process.env.MOCK_OPENAI = 'true';
  });

  it('streams joke data and ends properly', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    const data = res._getData();
    expect(res.getHeader('Content-Type')).toBe('text/event-stream');
    expect(data).toContain('[DONE]');
  });
});
