/**
 * Cloudflare Pages Function:/api/cover?url=<图片地址>
 * 作用:替「分享海报」把封面图取回来,并以「同源」的方式返回(带 CORS 头)。
 * 为什么需要:海报是在浏览器里用 canvas 绘制的,canvas 只能读取同源或明确允许跨域的图片。
 *   - Notion 里直接上传的封面(Notion 托管的图片)没有跨域许可,且链接会过期
 *   - 第三方代理(weserv 等)有时拿不到 Notion 的图
 *   经过这个函数,浏览器看到的就是本站自己的地址,海报就能正常取图。
 * 安全:只允许下面白名单里的图片域名,只接受 https,限制 8MB,只返回 image/*。
 */
const ALLOWED_HOSTS = [
  /(^|\.)notion\.so$/i,
  /(^|\.)notion-static\.com$/i,
  /(^|\.)amazonaws\.com$/i, // Notion 托管文件所在的 S3
  /(^|\.)xmcdn\.com$/i, // 喜马拉雅 CDN
  /(^|\.)ximalaya\.com$/i,
  /(^|\.)885111\.xyz$/i // 你自己的域名/图床/素材库(按需增减)
]
const MAX_BYTES = 8 * 1024 * 1024
const MAX_REDIRECTS = 4
const UA = 'Mozilla/5.0 (compatible; cover-proxy/1.0)'

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
      headers: { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.5' },
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
  if (!/^image\//i.test(type)) return reply(415, 'not an image')
  const len = Number(res.headers.get('content-length') || 0)
  if (len > MAX_BYTES) return reply(413, 'too large')

  return new Response(res.body, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
