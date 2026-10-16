const ALLOWED_PATH = /^\/3\/(trending\/all\/week|discover\/(movie|tv)|search\/(movie|tv|multi)|(?:movie|tv)\/\d+(?:\/videos)?)$/;

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
  'vote_count.gte'
]);

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = String(process.env.TMDB_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(500).json({
        error: 'TMDB_API_KEY belum disetel pada environment deployment'
      });
    }

    const rawPath = String(req.query?.path || '');
    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

    if (!ALLOWED_PATH.test(path)) {
      return res.status(400).json({ error: 'TMDB path tidak diizinkan' });
    }

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query || {})) {
      if (key === 'path' || value == null || Array.isArray(value)) continue;
      if (ALLOWED_PARAMS.has(key)) params.set(key, String(value));
    }

    if (!params.has('language')) params.set('language', 'id-ID');
    params.set('api_key', apiKey);

    const upstreamUrl = `https://api.themoviedb.org${path}?${params.toString()}`;
    const upstream = await fetch(upstreamUrl, { cache: 'no-store' });
    const body = await upstream.text();

    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600');
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    return res.status(upstream.status).send(body);
  } catch (error) {
    console.error('TMDB proxy error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'TMDB proxy gagal'
    });
  }
}
