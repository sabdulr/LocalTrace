import { test, expect } from 'vitest';
import { createRequire } from 'node:module';
import http from 'node:http';
import path from 'node:path';
const require = createRequire(path.resolve('package.json'));
const { createServer } = require('./server/server.cjs');

test('configured Docker origin accepts proxy host and rejects other hosts/origins', async () => {
  const server = createServer({ publicOrigin: 'https://trace.example.test' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const request = (host: string, origin: string, url = '/api/cancel') => new Promise<number>((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: url, method: url === '/healthz' ? 'GET' : 'POST', headers: {
      Host: host, Origin: origin, 'Content-Type': 'application/json', 'X-LocalTrace-Client': 'docker-test',
    } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode!)); });
    req.on('error', reject); req.end('{}');
  });
  try {
    expect(await request('trace.example.test', 'https://trace.example.test')).toBe(200);
    expect(await request('trace.example.test', 'http://trace.example.test')).toBe(403);
    expect(await request('evil.example.test', 'https://trace.example.test')).toBe(403);
    expect(await request(`127.0.0.1:${port}`, '', '/healthz')).toBe(200);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('rejects invalid public origin configuration', () => {
  for (const publicOrigin of ['https://example.com/', 'https://example.com/path', 'file:///tmp'])
    expect(() => createServer({ publicOrigin })).toThrow();
});
