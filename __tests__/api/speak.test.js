import { ReadableStream } from 'stream/web';
import { TextEncoder } from 'util';
import { createMocks } from 'node-mocks-http';

var createMock;

jest.mock('openai', () => {
  createMock = jest.fn().mockImplementation(() => ({
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('audio'));
        controller.close();
      },
    }),
  }));
  return jest.fn().mockImplementation(() => ({
    audio: {
      speech: {
        create: createMock,
      },
    },
  }));
});

import handler from '../../pages/api/speak';

beforeEach(() => {
  createMock.mockClear();
});

describe('POST /api/speak', () => {
  it('rejects GET requests with 405', async () => {
    const { req, res } = createMocks({ method: 'GET', query: { text: 'hello' } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it('requires text', async () => {
    const { req, res } = createMocks({ method: 'POST', body: {} });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ error: 'Missing text' });
  });

  it('rejects text over 500 characters', async () => {
    const { req, res } = createMocks({ method: 'POST', body: { text: 'a'.repeat(501) } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ error: 'Text must be 500 characters or fewer' });
  });

  it('returns audio when text is provided', async () => {
    const { req, res } = createMocks({ method: 'POST', body: { text: 'hello' } });
    await handler(req, res);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader('Content-Type')).toBe('audio/mpeg');
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ voice: 'coral' }));
  });

  it('passes a valid voice to OpenAI', async () => {
    const { req, res } = createMocks({ method: 'POST', body: { text: 'hello', voice: 'nova' } });
    await handler(req, res);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ voice: 'nova' }));
  });

  it('defaults to coral for an invalid voice', async () => {
    const { req, res } = createMocks({ method: 'POST', body: { text: 'hello', voice: 'badvoice' } });
    await handler(req, res);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ voice: 'coral' }));
  });
});
