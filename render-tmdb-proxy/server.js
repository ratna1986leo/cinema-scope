import express from 'express';

const app = express();
app.disable('x-powered-by');

const ALLOWED_PATH = /^\/3\/(trending\/all\/week|discover\/(movie|tv)|search\/(movie|tv|multi)|(?:movie|tv)\/\d+(?:\/videos|\/watch\/providers)?)$/;
const ALLOWED_PARAMS = new Set([
  'language',
  'query',
  'page',
  'include_adult',
  'sort_by',
  'with_genres',
  'with_origin_country',
  'primary_release_year',
  'first_air_date_year',
  'primary_release_date.gte',
  'primary_release_date.lte',
  'first_air_date.gte',
  'first_air_date.lte',
  'certification_country',
  'certification.gte',
  'certification.lte',
  'vote_count.gte',
  'region'
]);

function configuredOrigins() {
  return String(process.env.BLOGGER_ORIGINS || '')
    .split(',')
    .map(value => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function corsMiddleware(req, res, next) {
  const origin = String(req.headers.origin || '').trim().replace(/\/$/, '');
  const origins = configuredOrigins();

  // Requests without an Origin header (for example server-side health checks) are permitted.
  // Browser requests must match one of the exact origins configured on Render.
  if (origin && !origins.includes(origin)) {
    return res.status(403).json({
      error: 'Origin tidak diizinkan. Tambahkan URL blog ke BLOGGER_ORIGINS di Render.'
    });
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
}

app.use(corsMiddleware);

app.get('/', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    service: 'Cinema Scope TMDB Proxy',
    message: 'Render service aktif. Gunakan /api/tmdb?path=%2F3%2Ftrending%2Fall%2Fweek&language=id-ID'
  });
});

app.get('/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true });
});

app.get('/api/tmdb', async (req, res) => {
  const apiKey = String(process.env.TMDB_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({
      error: 'TMDB_API_KEY belum diatur pada Environment Variables Render.'
    });
  }

  const rawPath = String(req.query.path || '');
  const path = rawPath.startsWith('/') ? rawPath : '/' + rawPath;
  if (!ALLOWED_PATH.test(path)) {
    return res.status(400).json({ error: 'TMDB path tidak diizinkan.' });
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path' || value == null || Array.isArray(value)) continue;
    if (ALLOWED_PARAMS.has(key)) params.set(key, String(value));
  }
  if (!params.has('language')) params.set('language', 'id-ID');
  params.set('api_key', apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const target = 'https://api.themoviedb.org' + path + '?' + params.toString();
    const upstream = await fetch(target, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store'
    });
    const body = await upstream.text();

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    return res.status(upstream.status).send(body);
  } catch (error) {
    console.error('TMDB request failed:', error);
    return res.status(error?.name === 'AbortError' ? 504 : 502).json({
      error: error?.name === 'AbortError' ? 'TMDB request timeout.' : 'Gagal menghubungi TMDB.'
    });
  } finally {
    clearTimeout(timeout);
  }
});

app.all('/api/tmdb', (_req, res) => {
  res.setHeader('Allow', 'GET, OPTIONS');
  res.status(405).json({ error: 'Method not allowed.' });
});

const port = Number(process.env.PORT || 10000);
app.listen(port, '0.0.0.0', () => {
  console.log(`Cinema Scope TMDB proxy listening on port ${port}`);
});
