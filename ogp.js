const SUPABASE_URL='https://gzvfjzixkjbdwbzrhbdd.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6dmZqeml4a2piZHdienJoYmRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMDQ5OTEsImV4cCI6MjA5NTU4MDk5MX0.oEk8K5angcmu-tR5AOF3lTYOzmI_9o01Y7qxidtzPAY';
const SITE_URL='https://cdg-loa.vercel.app';
const DEFAULT_OG_IMAGE=SITE_URL+'/og-image.png';
const DEFAULT_TITLE="GRAIL — Designer Fashion Outfit Archives";
const DEFAULT_DESC='Designer fashion outfit archive. Record and discover outfits by reference number, line, and season.';
const CRAWLER_RE=/Twitterbot|facebookexternalhit|WhatsApp|Slackbot|LinkedInBot|TelegramBot|Discordbot|LINE|Googlebot|bingbot|Applebot|Pinterest/i;

export const config={runtime:'edge'};

export default async function handler(request){
  var url=new URL(request.url);
  var postId=url.searchParams.get('post');
  var ua=request.headers.get('user-agent')||'';
  var isCrawler=CRAWLER_RE.test(ua);
  if(!postId) return isCrawler?ogpResponse(DEFAULT_TITLE,DEFAULT_DESC,DEFAULT_OG_IMAGE,SITE_URL):redirect(SITE_URL);
  var spaUrl=SITE_URL+'/?post='+postId;
  if(!isCrawler) return redirect(spaUrl);
  try{
    var apiUrl=new URL(SUPABASE_URL+'/rest/v1/posts');
    apiUrl.searchParams.set('id','eq.'+postId);
    apiUrl.searchParams.set('select','title,caption,line,season,profiles(handle),post_images(url,position)');
    apiUrl.searchParams.set('limit','1');
    var res=await fetch(apiUrl.toString(),{headers:{'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_ANON_KEY,'Accept':'application/json'}});
    var posts=await res.json();
    var post=Array.isArray(posts)?posts[0]:null;
    if(!post) return ogpResponse(DEFAULT_TITLE,DEFAULT_DESC,DEFAULT_OG_IMAGE,spaUrl);
    var prof=post.profiles||{};
    var imgs=(post.post_images||[]).sort(function(a,b){return a.position-b.position;});
    var image=imgs[0]?imgs[0].url:DEFAULT_OG_IMAGE;
    var title=post.title?(post.title+' | GRAIL'):DEFAULT_TITLE;
    var desc=[post.caption?post.caption.slice(0,100):null,prof.handle?'@'+prof.handle:null,post.line||null,post.season||null].filter(Boolean).join(' / ')||DEFAULT_DESC;
    return ogpResponse(title,desc,image,spaUrl);
  }catch(e){return ogpResponse(DEFAULT_TITLE,DEFAULT_DESC,DEFAULT_OG_IMAGE,spaUrl);}
}

function escH(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function ogpResponse(title,desc,image,url){
  var h='<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>'+escH(title)+'</title>';
  h+='<meta property="og:type" content="article"><meta property="og:site_name" content="GRAIL">';
  h+='<meta property="og:title" content="'+escH(title)+'"><meta property="og:description" content="'+escH(desc)+'">';
  h+='<meta property="og:image" content="'+escH(image)+'"><meta property="og:url" content="'+escH(url)+'">';
  h+='<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'+escH(title)+'">';
  h+='<meta name="twitter:description" content="'+escH(desc)+'"><meta name="twitter:image" content="'+escH(image)+'">';
  h+='<meta http-equiv="refresh" content="0;url='+escH(url)+'"></head>';
  h+='<body><script>window.location.replace('+JSON.stringify(url)+');</script></body></html>';
  return new Response(h,{status:200,headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'public,max-age=60'}});
}

function redirect(url){return new Response(null,{status:302,headers:{Location:url}});}
