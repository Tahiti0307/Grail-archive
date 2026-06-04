// CDGLOA — Dynamic OGP Generator
// Route: /post/:id  → vercel.json で /api/ogp?post=:id にリライト

const SUPABASE_URL     = 'https://gzvfjzixkjbdwbzrhbdd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6dmZqeml4a2piZHdienJoYmRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMDQ5OTEsImV4cCI6MjA5NTU4MDk5MX0.oEk8K5angcmu-tR5AOF3lTYOzmI_9o01Y7qxidtzPAY';

const SITE_URL  = 'https://cdg-loa.vercel.app';
const SITE_NAME = 'CDGLOA';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;
const DEFAULT_TITLE    = "CDGLOA — COMME des GARÇONS LOVERS' OUTFIT ARCHIVES";
const DEFAULT_DESC     = 'ギャルソンラバーのためのコーデアーカイブ。着用アイテムを品番・ライン・シーズンで記録し、共有する。';

// クローラーの判定
const CRAWLER_RE = /Twitterbot|facebookexternalhit|WhatsApp|Slackbot|LinkedInBot|TelegramBot|Discordbot|LINE|Googlebot|bingbot|Yahoo|Baidu|DuckDuck|Applebot|Pinterest/i;

export const config = { runtime: 'edge' };

export default async function handler(request) {
  const url     = new URL(request.url);
  const postId  = url.searchParams.get('post');
  const ua      = request.headers.get('user-agent') || '';
  const isCrawler = CRAWLER_RE.test(ua);

  // postId がない場合はデフォルトOGP + リダイレクト
  if (!postId) {
    return isCrawler
      ? ogpResponse(DEFAULT_TITLE, DEFAULT_DESC, DEFAULT_OG_IMAGE, SITE_URL)
      : redirect(SITE_URL);
  }

  const spaUrl = `${SITE_URL}/?post=${postId}`;

  // 人間のアクセス → SPA にリダイレクト
  if (!isCrawler) {
    return redirect(spaUrl);
  }

  // クローラー → Supabase から投稿データ取得
  try {
    const apiUrl = new URL(`${SUPABASE_URL}/rest/v1/posts`);
    apiUrl.searchParams.set('id', `eq.${postId}`);
    apiUrl.searchParams.set('select', 'title,caption,line,season,profiles(handle),post_images(url,position)');
    apiUrl.searchParams.set('limit', '1');

    const res = await fetch(apiUrl.toString(), {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Accept': 'application/json',
      },
    });

    const posts = await res.json();
    const post  = Array.isArray(posts) ? posts[0] : null;

    if (!post) {
      return ogpResponse(DEFAULT_TITLE, DEFAULT_DESC, DEFAULT_OG_IMAGE, spaUrl);
    }

    // 投稿データからOGPを組み立て
    const prof  = post.profiles || {};
    const imgs  = (post.post_images || []).sort((a, b) => a.position - b.position);
    const image = imgs[0]?.url || DEFAULT_OG_IMAGE;

    const lineShort = (post.line || '').replace('COMME des GARÇONS ', 'CdG ');
    const title = post.title
      ? `${post.title}${lineShort ? ` — ${lineShort}` : ''}${post.season ? ` ${post.season}` : ''} | CDGLOA`
      : DEFAULT_TITLE;

    const desc = [
      post.caption ? post.caption.slice(0, 100) : null,
      prof.handle ? `@${prof.handle}` : null,
      lineShort || null,
      post.season || null,
    ].filter(Boolean).join(' · ') || DEFAULT_DESC;

    return ogpResponse(title, desc, image, spaUrl);

  } catch (e) {
    return ogpResponse(DEFAULT_TITLE, DEFAULT_DESC, DEFAULT_OG_IMAGE, spaUrl);
  }
}

function ogpResponse(title, desc, image, url) {
  const escaped = s => s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>${escaped(title)}</title>
  <meta name="description" content="${escaped(desc)}">

  <!-- OGP -->
  <meta property="og:type"        content="article">
  <meta property="og:site_name"   content="CDGLOA">
  <meta property="og:title"       content="${escaped(title)}">
  <meta property="og:description" content="${escaped(desc)}">
  <meta property="og:image"       content="${escaped(image)}">
  <meta property="og:url"         content="${escaped(url)}">
  <meta property="og:locale"      content="ja_JP">

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:site"        content="@tttaichi___">
  <meta name="twitter:title"       content="${escaped(title)}">
  <meta name="twitter:description" content="${escaped(desc)}">
  <meta name="twitter:image"       content="${escaped(image)}">

  <!-- 人間が直接アクセスした場合は SPA にリダイレクト -->
  <meta http-equiv="refresh" content="0;url=${escaped(url)}">
</head>
<body>
  <script>window.location.replace(${JSON.stringify(url)});</script>
  <p><a href="${escaped(url)}">コーデを見る</a></p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=3600',
    },
  });
}

function redirect(url) {
  return new Response(null, {
    status: 302,
    headers: { Location: url },
  });
}
