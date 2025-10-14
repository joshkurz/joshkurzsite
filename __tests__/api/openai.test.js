import { jest } from '@jest/globals';
import { createMocks } from 'node-mocks-http';
import { getAllJokeTexts } from '../../lib/jokesData';

function extractSSEPayload(raw) {
  return raw
    .split(/\n/)
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice('data: '.length))
    .filter((line) => line !== '[DONE]')
    .join('\n');
}

describe('GET /api/openai', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.MOCK_OPENAI;
    delete process.env.API_KEY;
    delete process.env.OPENAI_TIMEOUT_MS;
    delete process.env.OPENAI_STREAM_MODEL;
    delete process.env.OPENAI_STREAM_FALLBACK_MODEL;
    delete process.env.OPENAI_RESPONSE_MODEL;
    delete process.env.OPENAI_FALLBACK_MODEL;
    delete globalThis.__databaseState;
  });

  it('streams joke data and ends properly', async () => {
    process.env.MOCK_OPENAI = 'true';
    const handler = require('../../pages/api/openai').default;
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    const data = res._getData();
    expect(res.getHeader('Content-Type')).toBe('text/event-stream');
    expect(data).toContain('[DONE]');
  });

  it('falls back to file joke when OpenAI errors', async () => {
    process.env.API_KEY = 'test';
    jest.doMock('openai', () => {
      return jest.fn().mockImplementation(() => ({
        responses: {
          create: jest.fn().mockRejectedValue(new Error('boom'))
        }
      }));
    });
    const handler = require('../../pages/api/openai').default;
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    const data = res._getData();
    const payload = extractSSEPayload(data);
    const jokes = await getAllJokeTexts();
    const found = jokes.some((j) => payload.includes(j));
    expect(found).toBe(true);
    expect(data).toContain('[DONE]');
  });

  it('falls back to legacy model when verification error occurs', async () => {
    process.env.API_KEY = 'test';
    process.env.OPENAI_STREAM_MODEL = 'gpt-4.1';
    process.env.OPENAI_STREAM_FALLBACK_MODEL = 'gpt-4.1-mini';
    const create = jest
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('400 Your organization must be verified to stream this model.'), {
          status: 400
        })
      )
      .mockResolvedValueOnce(
        (async function* () {
          yield { delta: 'Fallback joke' };
        })()
      );

    jest.doMock('openai', () => {
      return jest.fn().mockImplementation(() => ({
        responses: {
          create
        }
      }));
    });

    const handler = require('../../pages/api/openai').default;
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    const data = res._getData();

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].model).toBe('gpt-4.1');
    expect(create.mock.calls[1][0].model).toBe('gpt-4.1-mini');
    expect(data).toContain('Fallback joke');
    expect(data).toContain('[DONE]');
  });

  it('falls back to file joke when request times out', async () => {
    process.env.API_KEY = 'test';
    process.env.OPENAI_TIMEOUT_MS = '10';
    jest.doMock('openai', () => {
      return jest.fn().mockImplementation(() => ({
        responses: {
          create: jest.fn(() => new Promise(() => {}))
        }
      }));
    });
    const handler = require('../../pages/api/openai').default;
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    const data = res._getData();
    const payload = extractSSEPayload(data);
    const jokes = await getAllJokeTexts();
    const found = jokes.some((j) => payload.includes(j));
    expect(found).toBe(true);
    expect(data).toContain('[DONE]');
  });
});
