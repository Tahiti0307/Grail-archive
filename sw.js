/* =====================================================
   GRAIL — Service Worker
   キャッシュ戦略:
   - HTML/JS/CSS → Network First（常に最新を取得、失敗時はキャッシュ）
   - 画像・フォント → Cache First（高速表示、バックグラウンドで更新）
   - Supabase API → Network Only（キャッシュしない）
===================================================== */

const CACHE_VERSION = 'grail-v7';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const IMAGE_CACHE   = `${CACHE_VERSION}-images`;

// オフライン時に使うキャッシュ対象
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
];

// =====================================================
//  Install: 基本リソースをキャッシュ
// =====================================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

// =====================================================
//  Activate: 古いキャッシュを削除
// =====================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k.startsWith('grail-') && k !== STATIC_CACHE && k !== IMAGE_CACHE)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// =====================================================
//  Fetch: リクエストをインターセプト
// =====================================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Supabase API・外部リソースはキャッシュしない
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.in') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('unpkg.com') ||
    request.method !== 'GET'
  ) {
    return; // ブラウザのデフォルト処理に任せる
  }

  // 画像 → Cache First
  if (request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|gif)$/i)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // フォント → Cache First
  if (request.destination === 'font' || url.hostname.includes('fonts.g')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML / JS / CSS → Network First
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

// =====================================================
//  キャッシュ戦略
// =====================================================

/** Network First: ネットワーク優先、失敗時はキャッシュ */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // オフラインフォールバック
    const fallback = await cache.match('/');
    return fallback || new Response('オフラインです。接続を確認してください。', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

/** Cache First: キャッシュ優先、なければネットワーク取得してキャッシュ */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return new Response('', { status: 404 });
  }
}
