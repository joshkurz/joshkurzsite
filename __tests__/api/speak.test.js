import { ReadableStream } from 'stream/web';
import { TextEncoder } from 'util';
import { createMocks } from 'node-mocks-http';

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    audio: {
      speech: {
        create: jest.fn().mockResolvedValue({
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('audio'));
              controller.close();
            },
          }),
        }),
      },
    },
  }));
});

import handler from '../../pages/api/speak';

describe('GET /api/speak', () => {
  it('requires text', async () => {
    const { req, res } = createMocks({ method: 'GET', query: {} });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ error: 'Missing text' });
  });

  it('returns audio when text is provided', async () => {
    const { req, res } = createMocks({ method: 'GET', query: { text: 'hello' } });
    await handler(req, res);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader('Content-Type')).toBe('audio/mpeg');
  });
});
