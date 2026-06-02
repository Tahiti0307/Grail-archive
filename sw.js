const CACHE_NAME = 'cdgloa-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// インストール: 静的アセットをキャッシュ
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// アクティベート: 古いキャッシュを削除
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// フェッチ: Network First（Supabase API等はキャッシュしない）
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase・外部APIはキャッシュしない
  if (url.hostname.includes('supabase') || url.hostname.includes('googleapis')) {
    return;
  }

  // GET以外はスキップ
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // 成功したレスポンスをキャッシュに保存
        if (res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        // オフライン時: キャッシュから返す
        caches.match(e.request).then(cached => cached || caches.match('/index.html'))
      )
  );
});
