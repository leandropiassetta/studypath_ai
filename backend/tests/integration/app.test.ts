import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

const app = buildApp();

afterAll(async () => {
  await app.close();
});

describe('empty app', () => {
  it('starts and returns 404 for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(404);
  });
});
