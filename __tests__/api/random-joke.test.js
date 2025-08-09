import handler from '../../pages/api/random-joke';
import { createMocks } from 'node-mocks-http';
import fs from 'fs';
import path from 'path';

describe('GET /api/random-joke', () => {
  it('returns a joke from the dataset', async () => {
    const jokesPath = path.join(process.cwd(), 'data', 'dad_jokes.txt');
    const jokes = fs.readFileSync(jokesPath, 'utf-8').split('\n\n').filter(Boolean);
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const data = res._getJSONData();
    expect(jokes).toContain(data.joke);
  });
});
