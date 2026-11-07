/**
 * Cloudflare Pages Function:/api/cover?url=<图片地址>
 * 作用:替「分享海报」把封面图取回来,并以「同源」的方式返回(带 CORS 头)。
 *
 * 在你线上版本的基础上,保留了你的全部改动(白名单扩充、Chrome UA、放宽 Content-Type),只补 4 处安全加固:
 *  1. 响应加 CSP sandbox + nosniff:这个函数是「同源」返回内容的,必须保证即使对方塞来 SVG/HTML 也不能执行脚本;
 *  2. 禁止 SVG(SVG 可以带脚本);
 *  3. amazonaws.com / cloudfront.net 这类「任何人都能开」的大域名,只允许作为 Notion 跳转后的目的地,
 *     不能作为请求的起点,避免你的函数被别人当成免费图片代理刷爆额度;
 *  4. 拒绝其他网站的盗用(Sec-Fetch-Site: cross-site),并限制实际传输的字节数(不只看 Content-Length)。
 */

// 允许作为「请求起点」的域名(海报只会拿这些域名的地址来请求)
const ALLOWED_START = [
  /(^|\.)notion\.so$/i,
  /(^|\.)notion\.site$/i, // Notion 跳转备用域名
  /(^|\.)notion-static\.com$/i,
  /(^|\.)notionusercontent\.com$/i, // Notion 新图片域名
  /^(prod-files-secure\.)?s3[.-]us-west-2\.amazonaws\.com$/i, // Notion 自己的 S3 桶(精确匹配,不开放整个 amazonaws.com)
  /(^|\.)xmcdn\.com$/i, // 喜马拉雅 CDN
  /(^|\.)ximalaya\.com$/i,
  /(^|\.)885111\.xyz$/i // 你自己的域名/图床/素材库
]
// 仅允许作为「跳转后的目的地」的大域名
const ALLOWED_REDIRECT_ONLY = [/(^|\.)amazonaws\.com$/i, /(^|\.)cloudfront\.net$/i]

const MAX_BYTES = 8 * 1024 * 1024
const MAX_REDIRECTS = 4
// 伪装成真实的 Chrome 浏览器,绕过 Notion 的防盗链
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const startOk = host => ALLOWED_START.some(re => re.test(host))
const hopOk = host => startOk(host) || ALLOWED_REDIRECT_ONLY.some(re => re.test(host))

const SAFE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox"
}
const reply = (status, text) =>
  new Response(text, { status, headers: { ...SAFE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } })

// 限制实际传输的字节数:超过上限就中断(有些响应没有 Content-Length)
function capBytes(body, limit) {
  let seen = 0
  return body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        seen += chunk.byteLength
        if (seen > limit) controller.error(new Error('too large'))
        else controller.enqueue(chunk)
      }
    })
  )
}

export async function onRequestGet({ request }) {
  // 拒绝其他网站直接引用(本站页面发起的请求是 same-origin;直接在地址栏打开是 none)
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') return reply(403, 'hotlinking not allowed')

  const raw = new URL(request.url).searchParams.get('url')
  let target
  try {
    target = new URL(raw)
  } catch (e) {
    return reply(400, 'bad url')
  }

  // 手动处理跳转:每一跳都重新检查域名
  let res
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const okHost = hop === 0 ? startOk(target.hostname) : hopOk(target.hostname)
    if (target.protocol !== 'https:' || !okHost) return reply(403, 'host not allowed')
    res = await fetch(target.href, {
      headers: {
        'User-Agent': UA,
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
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

  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  // 对方没写类型时放行(Notion 偶尔如此),明确是别的类型就拦;SVG 一律拦(可携带脚本)
  if (type && !type.startsWith('image/')) return reply(415, 'not an image: ' + type)
  if (type === 'image/svg+xml') return reply(415, 'svg not allowed')

  const len = Number(res.headers.get('content-length') || 0)
  if (len > MAX_BYTES) return reply(413, 'too large')
  if (!res.body) return reply(502, 'empty body')

  return new Response(capBytes(res.body, MAX_BYTES), {
    status: 200,
    headers: {
      ...SAFE_HEADERS,
      'Content-Type': type || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400'
    }
  })
}
