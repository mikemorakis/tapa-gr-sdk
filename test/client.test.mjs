import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TapaClient, TapaApiError, MCP_URL, OPENAPI_URL } from '../dist/index.js';

const mockFetch = (routes) => async (url) => {
  const u = new URL(url);
  const r = routes(u);
  return new Response(JSON.stringify(r.body), { status: r.status || 200, headers: { 'content-type': 'application/json', ...(r.headers || {}) } });
};

test('constants', () => {
  assert.equal(MCP_URL, 'https://tapa.gr/mcp');
  assert.equal(OPENAPI_URL, 'https://tapa.gr/openapi.json');
});

test('searchAll follows next_cursor', async () => {
  const seen = [];
  const c = new TapaClient({ fetch: mockFetch((u) => {
    seen.push(u.search);
    assert.equal(u.pathname, '/api/agent/search');
    const cur = u.searchParams.get('cursor');
    return { body: cur ? { query: 'seo', results: [{ title: 'B', url: 'https://tapa.gr/b/' }], limit: 20, total: 2, next_cursor: null }
      : { query: 'seo', results: [{ title: 'A', url: 'https://tapa.gr/a/' }], limit: 20, total: 2, next_cursor: 'c1' } };
  }) });
  const urls = [];
  for await (const r of c.searchAll('seo')) urls.push(r.url);
  assert.deepEqual(urls, ['https://tapa.gr/a/', 'https://tapa.gr/b/']);
  assert.match(seen[1], /cursor=c1/);
});

test('API errors become TapaApiError', async () => {
  const c = new TapaClient({ fetch: mockFetch(() => ({ status: 429, headers: { 'retry-after': '60' }, body: { error: { code: 'rate_limited', message: 'Rate limit exceeded' } } })) });
  await assert.rejects(c.getPricing(), (e) => e instanceof TapaApiError && e.status === 429 && e.code === 'rate_limited' && e.retryAfter === 60);
});

test('getPageMarkdown passes path', async () => {
  const c = new TapaClient({ fetch: mockFetch((u) => ({ body: { url: 'https://tapa.gr' + u.searchParams.get('path'), markdown: '# x' } })) });
  assert.equal((await c.getPageMarkdown('/about/')).url, 'https://tapa.gr/about/');
});

test('live API (set TAPA_LIVE=1)', { skip: !process.env.TAPA_LIVE }, async () => {
  const c = new TapaClient();
  const p = await c.getPricing();
  assert.equal(p.currency, 'EUR');
  const s = await c.searchPages('seo', { limit: 2 });
  assert.ok(s.results.length > 0 && 'next_cursor' in s);
});
