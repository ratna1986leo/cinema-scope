const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.TMDB_API_KEY;
const ROOT = __dirname;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

const ALLOWED_PARAMS = new Set([
  'language', 'page', 'region', 'sort_by', 'with_genres', 'with_original_language',
  'primary_release_year', 'first_air_date_year', 'year', 'include_adult',
  'include_video', 'vote_average.gte', 'vote_average.lte', 'vote_count.gte',
  'release_date.gte', 'release_date.lte', 'air_date.gte', 'air_date.lte',
  'query', 'append_to_response', 'with_watch_providers', 'watch_region',
  'with_watch_monetization_types', 'timezone', 'include_null_first_air_dates'
]);

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(JSON.stringify(body));
}

function corsHeaders(origin) {
  if (!origin) return {};
  if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function validTmdbPath(value) {
  if (!value || value.length > 240 || !value.startsWith('/3/')) return false;
  if (value.includes('..') || value.includes('\\') || value.includes('//')) return false;
  return /^\/3\/(trending\/(movie|tv)\/(day|week)|movie\/(popular|now_playing|upcoming|top_rated|\d+(?:\/(credits|videos|similar|recommendations|release_dates))?)|tv\/(popular|airing_today|on_the_air|top_rated|\d+(?:\/(credits|videos|similar|recommendations))?)|discover\/(movie|tv)|search\/(movie|tv|multi)|genre\/(movie|tv)\/list|configuration\/languages)$/.test(value);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const origin = req.headers.origin;
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    if (cors === null) return send(res, 403, { error: 'Origin not allowed' });
    res.writeHead(204, cors || {});
    return res.end();
  }

  if (url.pathname === '/health') {
    return send(res, 200, { ok: true, service: 'cinema-scope-tmdb-proxy' }, cors || {});
  }

  if (url.pathname === '/api/tmdb') {
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' }, cors || {});
    if (cors === null) return send(res, 403, { error: 'Origin not allowed' });
    if (!API_KEY) return send(res, 503, { error: 'TMDB_API_KEY is not configured on the server' }, cors || {});

    const tmdbPath = url.searchParams.get('path') || '';
    if (!validTmdbPath(tmdbPath)) return send(res, 400, { error: 'TMDB path is not allowed' }, cors || {});

    const target = new URL('https://api.themoviedb.org' + tmdbPath);
    target.searchParams.set('api_key', API_KEY);
    for (const [key, value] of url.searchParams.entries()) {
      if (key === 'path') continue;
      if (!ALLOWED_PARAMS.has(key)) continue;
      target.searchParams.set(key, value);
    }

    try {
      const upstream = await fetch(target, { headers: { Accept: 'application/json' } });
      const body = await upstream.text();
      res.writeHead(upstream.status, {
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...(cors || {})
      });
      return res.end(body);
    } catch (error) {
      console.error('TMDB request failed:', error.message);
      return send(res, 502, { error: 'Could not reach TMDB' }, cors || {});
    }
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    return fs.createReadStream(path.join(ROOT, 'index.html')).pipe(res);
  }

  return send(res, 404, { error: 'Not found' }, cors || {});
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Cinema Scope server listening on port ${PORT}`);
});
