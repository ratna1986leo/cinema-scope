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

function allowedOrigins(env) {
  return String(env.BLOGGER_ORIGINS || '')
    .split(',')
    .map(value => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function responseWithCors(body, status, requestOrigin, headers = {}) {
  const out = new Headers(headers);
  out.set('Content-Type', out.get('Content-Type') || 'application/json; charset=utf-8');
  out.set('Cache-Control', 'no-store');
  if (requestOrigin) {
    out.set('Access-Control-Allow-Origin', requestOrigin);
    out.set('Vary', 'Origin');
  }
  return new Response(body, { status, headers: out });
}

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
    const origin = (request.headers.get('Origin') || '').trim().replace(/\/$/, '');
    const origins = allowedOrigins(env);

    // Browser calls must originate from a blog URL explicitly allow-listed in BLOGGER_ORIGINS.
    if (origin && !origins.includes(origin)) {
      return new Response(JSON.stringify({
        error: 'Origin tidak diizinkan. Tambahkan URL blog ke BLOGGER_ORIGINS.'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    }

    if (request.method === 'OPTIONS') {
      const headers = new Headers({
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
      });
      if (origin) headers.set('Access-Control-Allow-Origin', origin);
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== 'GET') {
      return responseWithCors(JSON.stringify({ error: 'Method not allowed' }), 405, origin, {
        'Allow': 'GET, OPTIONS'
      });
    }

    // A root request is a small health check to help verify the Worker was deployed.
    const rawPath = requestUrl.searchParams.get('path');
    if (!rawPath && requestUrl.pathname === '/') {
      return responseWithCors(JSON.stringify({
        ok: true,
        service: 'TMDB proxy',
        message: 'Worker aktif. Permintaan TMDB harus menyertakan parameter path.'
      }), 200, origin);
    }

    const path = rawPath
      ? (rawPath.startsWith('/') ? rawPath : '/' + rawPath)
      : requestUrl.pathname;

    if (!ALLOWED_PATH.test(path)) {
      return responseWithCors(JSON.stringify({ error: 'TMDB path tidak diizinkan' }), 400, origin);
    }

    const apiKey = String(env.TMDB_API_KEY || '').trim();
    if (!apiKey) {
      return responseWithCors(JSON.stringify({
        error: 'Secret TMDB_API_KEY belum disetel pada Cloudflare Worker.'
      }), 500, origin);
    }

    const params = new URLSearchParams();
    for (const [key, value] of requestUrl.searchParams.entries()) {
      if (key === 'path') continue;
      if (ALLOWED_PARAMS.has(key)) params.set(key, value);
    }
    if (!params.has('language')) params.set('language', 'id-ID');
    params.set('api_key', apiKey);

    try {
      const upstreamUrl = 'https://api.themoviedb.org' + path + '?' + params.toString();
      const upstream = await fetch(upstreamUrl, {
        headers: { 'Accept': 'application/json' },
        cf: { cacheTtl: 0, cacheEverything: false }
      });
      const body = await upstream.text();
      return responseWithCors(body, upstream.status, origin, {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json; charset=utf-8'
      });
    } catch (error) {
      console.error('TMDB upstream request failed:', error);
      return responseWithCors(JSON.stringify({
        error: error instanceof Error ? error.message : 'TMDB upstream request failed'
      }), 502, origin);
    }
  }
};
