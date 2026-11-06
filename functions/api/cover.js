/**
 * Cloudflare Pages Function:/api/cover?url=<图片地址>
 * 作用:替「分享海报」把封面图取回来,并以「同源」的方式返回(带 CORS 头)。
 */
const ALLOWED_HOSTS = [
  /(^|\.)notion\.so$/i,
  /(^|\.)notion\.site$/i,           // 补充：Notion 跳转备用域名
  /(^|\.)notion-static\.com$/i,
  /(^|\.)notionusercontent\.com$/i, // 补充：Notion 新图片域名
  /(^|\.)amazonaws\.com$/i,         // 补充：Notion S3 存储
  /(^|\.)cloudfront\.net$/i,        // 补充：亚马逊 CDN
  /(^|\.)xmcdn\.com$/i,             // 喜马拉雅 CDN
  /(^|\.)ximalaya\.com$/i,
  /(^|\.)885111\.xyz$/i             // 你自己的域名/图床
]

const MAX_BYTES = 8 * 1024 * 1024
const MAX_REDIRECTS = 4
// ✨ 伪装成真实的 Chrome 浏览器，骗过 Notion 的防盗链
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const allowed = host => ALLOWED_HOSTS.some(re => re.test(host))
const reply = (status, text) =>
  new Response(text, { status, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain; charset=utf-8' } })

export async function onRequestGet({ request }) {
  const raw = new URL(request.url).searchParams.get('url')
  let target
  try {
    target = new URL(raw)
  } catch (e) {
    return reply(400, 'bad url')
  }

  // 手动处理跳转:每一跳都要重新检查域名,防止被引导去内网或不允许的地址
  let res
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (target.protocol !== 'https:' || !allowed(target.hostname)) return reply(403, 'host not allowed')
    res = await fetch(target.href, {
      headers: { 
        'User-Agent': UA, 
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      },
      redirect: 'manual',
      cf: { cacheTtl: 86400, cacheEverything: true }
    })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      try {
        target = new URL(res.headers.get('location'), target)
      } catch (e) {
        return reply(502, 'bad redirect')
      }
      continue
    }
    break
  }
  if (!res || !res.ok) return reply(502, `upstream ${res ? res.status : 'error'}`)

  const type = res.headers.get('content-type') || ''
  // 有时候 Notion 返回的 content-type 可能是空的，放宽一点检测
  if (type && !/^image\//i.test(type)) {
    return reply(415, 'not an image: ' + type)
  }
  
  const len = Number(res.headers.get('content-length') || 0)
  if (len > MAX_BYTES) return reply(413, 'too large')

  return new Response(res.body, {
    status: 200,
    headers: {
      'Content-Type': type || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
