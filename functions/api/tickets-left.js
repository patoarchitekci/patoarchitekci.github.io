const CHECKOUT_BASE = 'https://cart.easy.tools/checkout/patoarchitekci';
const CACHE_TTL = 60;
const SLUG_RE = /^[a-z0-9-]+$/;

const CONFIG = {
  conference: { fallback: 99, defaultSlug: 'konferencja-pato-200' },
  training:   { fallback: 12, defaultSlug: null },
};

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const type = url.searchParams.get('type') || 'conference';
  const cfg = CONFIG[type];
  const slug = url.searchParams.get('slug') || (cfg && cfg.defaultSlug);

  if (!cfg || !slug || !SLUG_RE.test(slug)) {
    return new Response(
      JSON.stringify({ error: 'invalid type or slug' }),
      { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } },
    );
  }

  const cache = caches.default;
  const cacheKey = new Request(`https://cache.internal/tickets-left/${type}/${slug}`, { method: 'GET' });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let remaining = cfg.fallback;
  let source = 'fallback';

  try {
    const res = await fetch(`${CHECKOUT_BASE}/${slug}`, {
      cf: { cacheTtl: 0, cacheEverything: false },
      headers: { 'user-agent': 'patoarchitekci-site/1.0' },
    });
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/"has_quantity":true,"quantity":(\d+)/);
      if (match) {
        remaining = parseInt(match[1], 10);
        source = 'live';
      } else {
        console.error('[tickets-left] quantity pattern not found:', type, slug);
      }
    } else {
      console.error('[tickets-left] checkout fetch non-OK:', res.status, type, slug);
    }
  } catch (err) {
    console.error('[tickets-left] fetch failed:', type, slug, err);
  }

  const body = JSON.stringify({
    remaining,
    source,
    type,
    slug,
    updated_at: new Date().toISOString(),
  });

  const response = new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, s-maxage=${CACHE_TTL}`,
      'access-control-allow-origin': '*',
    },
  });

  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
