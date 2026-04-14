const CHECKOUT_URL = 'https://cart.easy.tools/checkout/patoarchitekci/konferencja-pato-200';
const TICKET_LIMIT = 150;
const FALLBACK_REMAINING = 99;
const CACHE_TTL = 60;

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheKey = new Request('https://cache.internal/tickets-left', { method: 'GET' });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let remaining = FALLBACK_REMAINING;
  let source = 'fallback';

  try {
    const res = await fetch(CHECKOUT_URL, {
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
        console.error('[tickets-left] quantity pattern not found in checkout HTML');
      }
    } else {
      console.error('[tickets-left] checkout fetch non-OK:', res.status);
    }
  } catch (err) {
    console.error('[tickets-left] fetch failed:', err);
  }

  const body = JSON.stringify({
    remaining,
    limit: TICKET_LIMIT,
    sold: Math.max(0, TICKET_LIMIT - remaining),
    source,
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
