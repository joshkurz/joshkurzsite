import fs from 'fs';
import path from 'path';
import { createMocks } from 'node-mocks-http';

describe('GET /api/openai', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.MOCK_OPENAI;
    delete process.env.API_KEY;
    delete process.env.OPENAI_TIMEOUT_MS;
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
    const jokesPath = path.join(process.cwd(), 'data', 'dad_jokes.txt');
    const jokes = fs.readFileSync(jokesPath, 'utf-8').split('\n\n').filter(Boolean);
    const found = jokes.some(j => data.includes(j));
    expect(found).toBe(true);
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
    const jokesPath = path.join(process.cwd(), 'data', 'dad_jokes.txt');
    const jokes = fs.readFileSync(jokesPath, 'utf-8').split('\n\n').filter(Boolean);
    const found = jokes.some(j => data.includes(j));
    expect(found).toBe(true);
    expect(data).toContain('[DONE]');
  });
});
