import { useEffect, useRef, useState } from 'react'

const THEME = {
  primary: '#465982',
  primaryDeep: '#293957',
  ink: '#253047',
  muted: '#6E7788',
  paper: '#FBF8F2',
  paperShade: '#EEF0F6',
  border: 'rgba(70, 89, 130, 0.28)'
}

// 海报 Canvas 直接读取站点当前全局字体，避免写死系统字体；同时等待网页字体加载后再绘制。
function getPosterFont() {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const targets = [
      document.querySelector('.notion-page'),
      document.querySelector('.post-content'),
      document.querySelector('article'),
      document.querySelector('main'),
      document.body,
      document.documentElement
    ].filter(Boolean)
    const families = targets.map(target => window.getComputedStyle(target).fontFamily).filter(Boolean)
    const siteFont = families.find(family => /LXGW|落霞|WenKai|文楷/i.test(family))
    if (siteFont) return siteFont
    const family = families.find(value => value && value !== 'inherit')
    if (family) return family
  }
  return 'sans-serif'
}

const POSTER_SIZE = {
  portrait: { width: 900, height: 1230 },
  // 横版高度从 720 降低到 680，减少底部冗余留白
  landscape: { width: 1200, height: 680 }
}

// 用户指定的最终兜底默认封面（防止出现狗头等奇怪占位图）
const DEFAULT_COVER = 'https://up.885111.xyz/file/img/1789746781222_2027LOGO.webp'

const QR_CDN_CANDIDATES = [
  process.env.NEXT_PUBLIC_QR_CODE_CDN,
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
  'https://unpkg.com/qrcodejs@1.0.0/qrcode.min.js'
].filter((value, index, list) => value && list.indexOf(value) === index)

const qrScriptPromises = new Map()
const coverImagePromises = new Map()

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.arcTo(x + width, y, x + width, y + r, r)
  ctx.lineTo(x + width, y + height - r)
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r)
  ctx.lineTo(x + r, y + height)
  ctx.arcTo(x, y + height, x, y + height - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function fillRoundRect(ctx, x, y, width, height, radius, color) {
  roundRect(ctx, x, y, width, height, radius)
  ctx.fillStyle = color
  ctx.fill()
}

function strokeRoundRect(ctx, x, y, width, height, radius, color, lineWidth = 2) {
  roundRect(ctx, x, y, width, height, radius)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

function cleanText(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function getEpisodeNumber(post) {
  const candidate = String(post?.slug || post?.href || post?.url || '')
  const match = candidate.match(/(\d+)(?!.*\d)/)
  return match ? `E${match[1]}` : ''
}

function getTagNames(post) {
  const raw = Array.isArray(post?.tagItems)
    ? post.tagItems
    : Array.isArray(post?.tags)
      ? post.tags
      : []
  const names = raw
    .map(item => cleanText(typeof item === 'string' ? item : item?.name || item?.value || item?.title || ''))
    .filter(Boolean)
  return [...new Set(names)]
}

function getMetaText(post) {
  const segments = []
  const episode = getEpisodeNumber(post)
  const category = cleanText(post?.category)
  const date = cleanText(post?.publishDay || post?.date)
  const names = getTagNames(post)
  const visibleNames = names.slice(0, 3)
  if (names.length > 3) visibleNames.push(`+${names.length - 3}`)

  const episodeCategory = [episode, category].filter(Boolean).join(' ')
  if (episodeCategory) segments.push(episodeCategory)
  if (date) segments.push(date)
  if (visibleNames.length) segments.push(visibleNames.join(' '))
  return segments.join(' / ')
}

function decodeRepeated(value) {
  let current = String(value || '').trim()
  const results = []
  for (let i = 0; i < 4 && current; i += 1) {
    if (/^https?:\/\//i.test(current)) results.push(current)
    let decoded = current
    try {
      decoded = decodeURIComponent(current)
    } catch {}
    if (decoded === current) break
    current = decoded
  }
  return results
}

function expandImageUrl(rawValue) {
  if (!rawValue) return []
  if (typeof rawValue !== 'string') return []

  const raw = rawValue.trim()
  if (!raw) return []
  const values = []

  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.href : 'https://na.885111.xyz/')
    const imageIndex = parsed.pathname.indexOf('/image/')
    if (imageIndex >= 0) {
      const encodedSource = parsed.pathname.slice(imageIndex + '/image/'.length)
      values.push(...decodeRepeated(encodedSource))
    }
    for (const key of ['url', 'src', 'image']) {
      const queryValue = parsed.searchParams.get(key)
      if (queryValue) values.push(...decodeRepeated(queryValue))
    }
    if (imageIndex < 0 && /(^|\.)notion\.so$/i.test(parsed.hostname)) {
      const lastSegment = parsed.pathname.split('/').pop()
      if (lastSegment) values.push(...decodeRepeated(lastSegment))
    }
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') values.push(parsed.href)
  } catch {
    values.push(...decodeRepeated(raw))
  }

  const clean = []
  for (const value of values) {
    try {
      const parsed = new URL(value)
      if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !clean.includes(parsed.href)) {
        clean.push(parsed.href)
      }
    } catch {}
  }
  return clean
}

function getUrlsFromValue(value, depth = 0) {
  if (!value || depth > 7) return []
  if (typeof value === 'string') {
    if (!/^https?:\/\//i.test(value.trim()) && !value.trim().startsWith('/')) return []
    return expandImageUrl(value)
  }
  if (Array.isArray(value)) return value.flatMap(item => getUrlsFromValue(item, depth + 1))
  if (typeof value !== 'object') return []

  const urls = []
  for (const key of [
    'url', 'external', 'file', 'src', 'originalUrl', 'original_url',
    'image', 'cover', 'value', 'files', 'thumbnail', 'pageCover',
    'page_cover', 'coverUrl', 'cover_url', 'imageUrl', 'image_url',
    'featuredImage', 'featured_image', 'properties'
  ]) {
    if (value[key] !== undefined && value[key] !== null) {
      urls.push(...getUrlsFromValue(value[key], depth + 1))
    }
  }
  return [...new Set(urls)]
}

function getCoverCandidates(post) {
  if (!post || typeof post !== 'object') return []
  const fieldCandidates = []
  const pageCandidates = []
  const collect = (target, value) => {
    getUrlsFromValue(value).forEach(url => {
      if (!target.includes(url)) target.push(url)
    })
  }
  const addField = value => collect(fieldCandidates, value)
  const addPage = value => collect(pageCandidates, value)

  const slugValue = cleanText(post.slug || post.href || post.url)
  let slug = slugValue.replace(/^\/+|\/+$/g, '').toLocaleLowerCase()
  try {
    if (/^https?:\/\//i.test(slugValue)) slug = decodeURIComponent(new URL(slugValue).pathname).replace(/^\/+|\/+$/g, '').toLocaleLowerCase()
  } catch {}

  let currentPath = ''
  if (typeof window !== 'undefined') {
    try { currentPath = decodeURIComponent(window.location.pathname).replace(/^\/+|\/+$/g, '').toLocaleLowerCase() }
    catch { currentPath = window.location.pathname.replace(/^\/+|\/+$/g, '').toLocaleLowerCase() }
  }
  const currentEpisodePage = Boolean(slug && currentPath && (currentPath.includes(slug) || slug.includes(currentPath)))

  const values = [
    post.cover, post.page?.cover, post.pageCoverOriginal, post.originalCoverUrl,
    post.coverOriginal, post.pageCover, post.page_cover, post.pageCoverThumbnail,
    post.coverUrl, post.cover_url, post.thumbnail, post.image, post.imageUrl,
    post.image_url, post.featuredImage, post.featured_image,
    post.properties?.Cover, post.properties?.cover, post.properties?.Image,
    post.properties?.image, post.properties?.封面, post.properties?.海报, post.properties?.图片
  ]
  values.forEach(addField)

  if (typeof document !== 'undefined') {
    const title = cleanText(post.title).toLocaleLowerCase()
    const images = Array.from(document.querySelectorAll('img'))

    if (currentEpisodePage) {
      for (const selector of [
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
        'meta[property="twitter:image"]'
      ]) {
        document.querySelectorAll(selector).forEach(meta => addPage(meta.getAttribute('content')))
      }
    }

    for (const image of images) {
      const alt = cleanText(image.getAttribute('alt')).toLocaleLowerCase()
      const anchor = image.closest('a[href]')
      let anchorPath = ''
      try { anchorPath = decodeURIComponent(new URL(anchor?.href || '', window.location.href).pathname).toLocaleLowerCase() } catch {}
      const titleMatch = title.length > 3 && (alt.includes(title) || (title.includes(alt) && alt.length > 3))
      const slugMatch = slug.length > 2 && anchorPath.includes(slug)
      if (titleMatch || slugMatch) {
        addPage(image.currentSrc || image.src || image.getAttribute('data-src') || image.getAttribute('data-original'))
        addPage(image.getAttribute('data-original'))
      }
    }

    if (currentEpisodePage) {
      const selectors = [
        '.post-cover img', '.post-header img', '.notion-page-cover img',
        'article img', '.notion-page img', '.post-content > img', 'main img', 'img'
      ]
      const seen = new Set()
      for (const selector of selectors) {
        for (const image of document.querySelectorAll(selector)) {
          if (seen.has(image)) continue
          seen.add(image)
          addPage(image.currentSrc || image.src || image.getAttribute('data-src') || image.getAttribute('data-original'))
          addPage(image.getAttribute('data-original'))
        }
      }
      for (const selector of ['article', '.post-cover', '.post-header', '.notion-page-cover', '[class*="cover"]']) {
        for (const node of document.querySelectorAll(selector)) {
          const bg = window.getComputedStyle(node).backgroundImage
          const matches = bg && [...bg.matchAll(/url\(["']?(.*?)["']?\)/g)]
          if (matches) matches.forEach(match => addPage(match[1]))
        }
      }
    }
  }

  return [...new Set([...pageCandidates, ...fieldCandidates])].slice(0, 28)
}

function loadImage(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (!url || typeof window === 'undefined') {
      reject(new Error('没有可用的图片 URL'))
      return
    }

    const image = new window.Image()
    let settled = false
    const timeout = window.setTimeout(() => finish(new Error('图片请求超时')), timeoutMs)
    const finish = (error, result) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      image.onload = null
      image.onerror = null
      if (error) reject(error)
      else resolve(result)
    }

    image.decoding = 'async'
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) finish(null, image)
      else finish(new Error('图片尺寸无效'))
    }
    image.onerror = () => finish(new Error('图片无法加载或服务器拒绝跨域读取'))

    try {
      const parsed = new URL(url, window.location.href)
      if (parsed.origin !== window.location.origin) image.crossOrigin = 'anonymous'
      image.src = parsed.href
    } catch (error) {
      finish(error instanceof Error ? error : new Error('图片 URL 格式无效'))
    }
  })
}

function getProxyUrls(source) {
  const encoded = encodeURIComponent(source)
  return [
    `https://images.weserv.nl/?url=${encoded}`,
    `https://wsrv.nl/?url=${encoded}`
  ]
}

async function tryCandidate(source, deadline) {
  const attempts = [...new Set([source, ...getProxyUrls(source)])]
  const remaining = deadline - Date.now()
  if (remaining <= 0) throw new Error('封面加载总时限已到')

  const timeoutMs = Math.max(700, Math.min(4200, remaining))
  try {
    return await Promise.any(attempts.map(url => loadImage(url, timeoutMs)))
  } catch (error) {
    throw error?.errors?.[0] || new Error('原图及图片代理均加载失败')
  }
}

async function loadCoverImage(post) {
  const candidates = getCoverCandidates(post)
  // 将用户指定的默认封面作为最终的兜底候选加入队列
  if (!candidates.includes(DEFAULT_COVER)) {
    candidates.push(DEFAULT_COVER)
  }

  const key = candidates.join('|')
  if (coverImagePromises.has(key)) return coverImagePromises.get(key)

  const promise = (async () => {
    const deadline = Date.now() + 15000
    let lastError = null
    // 按顺序尝试，包含了原本有效封面以及最后的默认 Logo
    const prioritized = candidates.slice(0, 15)
    for (const candidate of prioritized) {
      if (Date.now() >= deadline) break
      try {
        return await tryCandidate(candidate, deadline)
      } catch (error) {
        lastError = error
      }
    }
    if (typeof console !== 'undefined') {
      const candidateHosts = candidates.map(candidate => {
        try {
          const parsed = new URL(candidate)
          return `${parsed.hostname}${parsed.pathname.slice(0, 48)}`
        } catch {
          return '(无效 URL)'
        }
      })
      console.warn('[SharePoster] 所有封面地址加载失败', {
        candidateCount: candidates.length,
        candidateHosts,
        lastError: lastError?.message || '无可用地址'
      })
    }
    return null
  })()

  coverImagePromises.set(key, promise)
  const result = await promise
  if (!result) coverImagePromises.delete(key)
  return result
}

function cropSquare(ctx, image, x, y, size, radius) {
  if (!image) return false
  const naturalWidth = image.naturalWidth || image.width
  const naturalHeight = image.naturalHeight || image.height
  if (!naturalWidth || !naturalHeight) return false

  ctx.save()
  roundRect(ctx, x, y, size, size, radius)
  ctx.clip()
  const scale = Math.max(size / naturalWidth, size / naturalHeight)
  const width = naturalWidth * scale
  const height = naturalHeight * scale
  ctx.drawImage(image, x + (size - width) / 2, y + (size - height) / 2, width, height)
  ctx.restore()
  return true
}

function drawBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width * 0.92, height)
  gradient.addColorStop(0, '#FFFCF7')
  gradient.addColorStop(0.58, '#F7F5F1')
  gradient.addColorStop(1, '#E9EDF6')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  const glow = ctx.createRadialGradient(width * 0.88, height * 0.12, 8, width * 0.88, height * 0.12, width * 0.65)
  glow.addColorStop(0, 'rgba(112, 132, 174, 0.10)')
  glow.addColorStop(1, 'rgba(112, 132, 174, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  strokeRoundRect(ctx, 24, 24, width - 48, height - 48, 15, THEME.border, 2)
  strokeRoundRect(ctx, 34, 34, width - 68, height - 68, 10, 'rgba(70, 89, 130, 0.08)', 1)
}

function splitLines(ctx, text, maxWidth, maxLines) {
  const characters = Array.from(cleanText(text))
  if (!characters.length) return []
  const lines = []
  let line = ''

  characters.forEach(character => {
    const candidate = line + character
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = character
    } else {
      line = candidate
    }
  })
  if (line) lines.push(line)

  if (lines.length > maxLines) {
    const visible = lines.slice(0, maxLines)
    let last = visible[visible.length - 1] || ''
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1)
    visible[visible.length - 1] = `${last.trimEnd()}…`
    return visible
  }
  return lines
}

function drawLines(ctx, lines, x, y, lineHeight) {
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight))
  return y + lines.length * lineHeight
}

function drawDurationPill(ctx, x, y, duration) {
  if (!duration) return 0
  const height = 42
  ctx.font = `500 20px ${getPosterFont()}`
  const textWidth = Math.ceil(ctx.measureText(duration).width)
  const pillWidth = 18 + 16 + 10 + textWidth + 17

  ctx.save()
  try {
    const glass = document.createElement('canvas')
    glass.width = Math.max(1, Math.ceil(pillWidth))
    glass.height = height
    const glassCtx = glass.getContext('2d')
    if (glassCtx) {
      glassCtx.filter = 'blur(7px)'
      glassCtx.drawImage(ctx.canvas, x - 5, y - 5, pillWidth + 10, height + 10, -5, -5, pillWidth + 10, height + 10)
      glassCtx.filter = 'none'
      roundRect(ctx, x, y, pillWidth, height, height / 2)
      ctx.clip()
      ctx.drawImage(glass, x, y, pillWidth, height)
      ctx.restore()
      ctx.save()
    }
  } catch {}
  roundRect(ctx, x, y, pillWidth, height, height / 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.17)'
  ctx.fill()

  ctx.shadowColor = 'rgba(15, 20, 30, 0.48)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 1
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.moveTo(x + 15, y + 12)
  ctx.lineTo(x + 15, y + 30)
  ctx.lineTo(x + 29, y + 21)
  ctx.closePath()
  ctx.fill()
  ctx.font = `500 20px ${getPosterFont()}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(duration, x + 42, y + height / 2 + 0.5)
  ctx.restore()
  return pillWidth
}

function drawBrandAndQr(ctx, qrCanvas, width, height, layout) {
  const { edge, brandY, qrSize } = layout

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = THEME.ink
  ctx.font = `600 ${layout.brandFont}px ${getPosterFont()}`
  ctx.fillText('念安酒馆', edge + 2, brandY)

  ctx.fillStyle = THEME.primary
  ctx.font = `400 ${layout.subFont}px ${getPosterFont()}`
  ctx.fillText('扫码收听本期', edge + 3, brandY + layout.subOffset)

  const qrShiftLeft = layout.qrShiftLeft ?? 8
  const qrX = width - edge - qrSize - qrShiftLeft
  const textBottom = brandY + layout.subOffset + layout.subFont
  const qrY = Math.round(textBottom - qrSize - 7)

  if (qrCanvas) {
    fillRoundRect(ctx, qrX - 7, qrY - 7, qrSize + 14, qrSize + 14, 8, '#FFFFFF')
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)
    strokeRoundRect(ctx, qrX - 7, qrY - 7, qrSize + 14, qrSize + 14, 8, 'rgba(70, 89, 130, 0.14)', 1)
  } else {
    fillRoundRect(ctx, qrX - 7, qrY - 7, qrSize + 14, qrSize + 14, 8, 'rgba(255,255,255,0.62)')
  }
}

function drawPoster(canvas, { post, orientation, duration }, coverImage, qrCanvas) {
  const { width, height } = POSTER_SIZE[orientation]
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 初始化失败')

  drawBackground(ctx, width, height)
  const title = cleanText(post?.title) || '这一期，等你来听'
  const summary = cleanText(post?.summary || post?.description || post?.excerpt || '')
  const meta = getMetaText(post)

  if (orientation === 'portrait') {
    const edge = 58
    const contentX = edge + 2 
    const contentWidth = width - edge * 2 - 4 // 900 - 116 - 4 = 780
    
    const coverY = 48
    // 使封面图宽度与下方文字区域宽度完全一致
    const coverSize = contentWidth 
    const coverX = contentX

    // 仅绘制封面
    cropSquare(ctx, coverImage, coverX, coverY, coverSize, 9)
    if (duration && coverImage) drawDurationPill(ctx, coverX + 18, coverY + coverSize - 59, duration)

    let currentY = coverY + coverSize + 31
    ctx.fillStyle = THEME.ink
    ctx.font = `650 41px ${getPosterFont()}`
    const titleLines = splitLines(ctx, title, contentWidth, 2)
    currentY = drawLines(ctx, titleLines, contentX, currentY, 52) + 11

    if (meta) {
      ctx.fillStyle = THEME.primary
      ctx.font = `400 21px ${getPosterFont()}`
      const metaLines = splitLines(ctx, meta, contentWidth, 2)
      currentY = drawLines(ctx, metaLines, contentX, currentY, 29) + 10
    }

    const footerY = 1092
    if (summary && currentY < footerY - 16) {
      ctx.fillStyle = THEME.muted
      ctx.font = `400 24px ${getPosterFont()}`
      const availableLines = Math.max(1, Math.min(3, Math.floor((footerY - currentY - 16) / 33)))
      drawLines(ctx, splitLines(ctx, summary, contentWidth - 2, availableLines), contentX, currentY, 35)
    }

    drawBrandAndQr(ctx, qrCanvas, width, height, {
      edge,
      brandY: 1120,
      qrSize: 90,
      brandFont: 31,
      subFont: 21,
      subOffset: 41,
      qrShiftLeft: 8
    })
  } else {
    const edge = 44
    const coverX = 47
    const coverY = 45 // 从 54 微调上移，配合整体高度缩小
    const coverSize = 410
    
    cropSquare(ctx, coverImage, coverX, coverY, coverSize, 9)
    if (duration && coverImage) drawDurationPill(ctx, coverX + 16, coverY + coverSize - 58, duration)

    const contentX = 500
    const contentWidth = width - contentX - edge - 2

    ctx.font = `650 40px ${getPosterFont()}`
    const titleLines = splitLines(ctx, title, contentWidth, 2)
    ctx.font = `400 20px ${getPosterFont()}`
    const metaLines = meta ? splitLines(ctx, meta, contentWidth, 2) : []
    ctx.font = `400 23px ${getPosterFont()}`
    const summaryLines = summary ? splitLines(ctx, summary, contentWidth, 5) : []
    const blockHeight =
      titleLines.length * 50 +
      (metaLines.length ? 13 + metaLines.length * 29 : 0) +
      (summaryLines.length ? 14 + summaryLines.length * 33 : 0)
    let currentY = coverY + Math.max(0, Math.floor((coverSize - blockHeight) / 2))

    ctx.fillStyle = THEME.ink
    ctx.font = `650 40px ${getPosterFont()}`
    currentY = drawLines(ctx, titleLines, contentX, currentY, 50)

    if (metaLines.length) {
      currentY += 13
      ctx.fillStyle = THEME.primary
      ctx.font = `400 20px ${getPosterFont()}`
      currentY = drawLines(ctx, metaLines, contentX, currentY, 29)
    }

    if (summaryLines.length) {
      currentY += 14
      ctx.fillStyle = THEME.muted
      ctx.font = `400 23px ${getPosterFont()}`
      drawLines(ctx, summaryLines, contentX, currentY, 33)
    }

    // 底部品牌区上提（原 596），使下方留白从“两行”减至“一行”
    drawBrandAndQr(ctx, qrCanvas, width, height, {
      edge: 48,
      brandY: 550, 
      qrSize: 82,
      brandFont: 30,
      subFont: 20,
      subOffset: 39,
      qrShiftLeft: 8
    })
  }
}

function formatDuration(seconds) {
  const total = Math.floor(Number(seconds))
  if (!Number.isFinite(total) || total <= 0) return ''
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remainder = total % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`
}

function formatDurationValue(value) {
  if (Number.isFinite(Number(value)) && Number(value) > 0) return formatDuration(value)
  const text = cleanText(value)
  return /^\d{1,3}:\d{2}(?::\d{2})?$/.test(text) ? text : ''
}

function getAudioUrl(post) {
  const candidates = [post?.audio, post?.ext, post?.audioUrl, post?.audio_url, post?.enclosure]
  for (const candidate of candidates) {
    const url = typeof candidate === 'string' ? candidate.trim() : candidate?.url
    if (/^https?:\/\//i.test(url || '')) return url
  }
  return ''
}

async function loadQrScript(url) {
  if (typeof window === 'undefined') throw new Error('当前环境无法生成二维码')
  if (typeof window.QRCode === 'function') return
  if (qrScriptPromises.has(url)) return qrScriptPromises.get(url)

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    let settled = false
    const timer = window.setTimeout(() => finish(new Error('二维码脚本超时')), 4500)
    const finish = error => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      script.onload = null
      script.onerror = null
      if (error) reject(error)
      else if (typeof window.QRCode === 'function') resolve()
      else reject(new Error('二维码脚本没有提供 QRCode'))
    }
    script.src = url
    script.async = true
    script.dataset.snShareQr = 'true'
    script.onload = () => finish()
    script.onerror = () => finish(new Error('二维码脚本加载失败'))
    document.head.appendChild(script)
  })

  qrScriptPromises.set(url, promise)
  try {
    await promise
  } catch (error) {
    qrScriptPromises.delete(url)
    throw error
  }
}

async function createQrCanvas(value) {
  if (!value || typeof document === 'undefined') return null
  let QRCodeConstructor = typeof window !== 'undefined' ? window.QRCode : null

  if (typeof QRCodeConstructor !== 'function') {
    for (const url of QR_CDN_CANDIDATES) {
      try {
        await loadQrScript(url)
        QRCodeConstructor = window.QRCode
        if (typeof QRCodeConstructor === 'function') break
      } catch {}
    }
  }
  if (typeof QRCodeConstructor !== 'function') return null

  try {
    const host = document.createElement('div')
    new QRCodeConstructor(host, {
      text: value,
      width: 256,
      height: 256,
      colorDark: '#1E293B',
      colorLight: '#FFFFFF',
      correctLevel: QRCodeConstructor.CorrectLevel?.H ?? 2
    })
    const directCanvas = host.querySelector('canvas')
    if (directCanvas) return directCanvas

    const image = host.querySelector('img')
    if (!image) return null
    if (!image.complete || image.naturalWidth === 0) {
      await new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('二维码图片超时')), 2200)
        image.onload = () => { window.clearTimeout(timer); resolve() }
        image.onerror = () => { window.clearTimeout(timer); reject(new Error('二维码图片失败')) }
      })
    }
    if (!image.naturalWidth) return null
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (!context) return null
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, 256, 256)
    context.drawImage(image, 0, 0, 256, 256)
    return canvas
  } catch (error) {
    if (typeof console !== 'undefined') console.warn('[SharePoster] 二维码生成失败', error?.message || error)
    return null
  }
}

function safeFileName(value) {
  return String(value ? `${value}-念安酒馆` : '念安酒馆分享海报')
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export default function SharePosterModal({ open, onClose, post, shareUrl }) {
  const canvasRef = useRef(null)
  const [orientation, setOrientation] = useState('portrait')
  const [ready, setReady] = useState(false)
  const [duration, setDuration] = useState('')
  const [copied, setCopied] = useState(false)

  const size = POSTER_SIZE[orientation]

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = event => {
      if (event.key === 'Escape') onClose?.()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    const setFromSeconds = seconds => {
      const formatted = formatDuration(seconds)
      if (!cancelled && formatted) setDuration(formatted)
    }

    const explicitDuration = formatDurationValue(post?.duration || post?.audioDuration || post?.audio_duration)
    if (explicitDuration) {
      setDuration(explicitDuration)
      return () => { cancelled = true }
    }

    const audioElements = Array.from(document.querySelectorAll('audio'))
    const existing = audioElements.find(element => Number.isFinite(element.duration) && element.duration > 0)
    if (existing) {
      setFromSeconds(existing.duration)
      return () => { cancelled = true }
    }

    const audioUrl = getAudioUrl(post)
    if (!audioUrl) {
      setDuration('')
      return () => { cancelled = true }
    }

    const probe = new Audio()
    probe.preload = 'metadata'
    const timer = window.setTimeout(() => {
      probe.src = ''
    }, 7000)
    probe.onloadedmetadata = () => {
      window.clearTimeout(timer)
      setFromSeconds(probe.duration)
      probe.src = ''
    }
    probe.onerror = () => {
      window.clearTimeout(timer)
      probe.src = ''
    }
    probe.src = audioUrl

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      probe.onloadedmetadata = null
      probe.onerror = null
      probe.src = ''
    }
  }, [open, post])

  useEffect(() => {
    if (!open || !canvasRef.current) return undefined
    let cancelled = false
    const canvas = canvasRef.current
    const options = { post, orientation, duration }
    let loadedCover = null
    let loadedQr = null
    let coverDone = false
    let qrDone = false

    setReady(false)
    try {
      drawPoster(canvas, options, null, null)
    } catch (error) {
      console.error('[SharePoster] 初始海报绘制失败', error)
      return undefined
    }

    const repaint = () => {
      if (cancelled || !canvasRef.current) return
      try {
        drawPoster(canvasRef.current, options, loadedCover, loadedQr)
      } catch (error) {
        console.error('[SharePoster] 海报重绘失败', error)
      }
      if (coverDone && qrDone) setReady(Boolean(loadedQr))
    }

    if (document.fonts?.ready) document.fonts.ready.then(() => { if (!cancelled) repaint() })

    loadCoverImage(post)
      .then(image => {
        if (cancelled) return
        loadedCover = image
        coverDone = true
        repaint()
      })
      .catch(error => {
        if (typeof console !== 'undefined') console.warn('[SharePoster] 封面加载流程异常', error?.message || error)
        if (cancelled) return
        coverDone = true
        repaint()
      })

    createQrCanvas(shareUrl)
      .then(qr => {
        if (cancelled) return
        loadedQr = qr
        qrDone = true
        repaint()
      })
      .catch(() => {
        if (cancelled) return
        qrDone = true
        repaint()
      })

    return () => { cancelled = true }
  }, [open, post, shareUrl, orientation, duration])

  useEffect(() => {
    if (open) setCopied(false)
  }, [open])

  if (!open) return null

  const copyLink = async () => {
    const value = shareUrl || (typeof window !== 'undefined' ? window.location.href : '')
    if (!value) return
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value)
      else throw new Error('Clipboard API unavailable')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      try {
        const input = document.createElement('textarea')
        input.value = value
        input.setAttribute('readonly', '')
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        const successful = document.execCommand('copy')
        input.remove()
        if (successful) {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1600)
        }
      } catch (error) {
        console.error('[SharePoster] 复制链接失败', error)
      }
    }
  }

  const downloadPoster = async () => {
    const canvas = canvasRef.current
    if (!canvas || !ready) return
    try {
      if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('PNG 导出失败')
      const downloadUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = `${safeFileName(post?.title)}.png`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1200)
    } catch (error) {
      console.error('[SharePoster] 下载海报失败', error)
    }
  }

  return (
    <div
      className='sn-share-overlay'
      role='presentation'
      onMouseDown={event => event.target === event.currentTarget && onClose?.()}
    >
      <section
        className={`sn-share-dialog ${orientation}`}
        role='dialog'
        aria-modal='true'
        aria-labelledby='sn-share-title'
      >
        <header className='sn-share-header'>
          <h2 id='sn-share-title'>分享这一期</h2>
          <button type='button' className='sn-share-close' aria-label='关闭' onClick={onClose}>×</button>
        </header>

        <div className={`sn-share-body ${orientation}`}>
          <div className={`sn-share-preview ${orientation}`}>
            <canvas
              ref={canvasRef}
              width={size.width}
              height={size.height}
              aria-label='节目分享海报预览'
              className={`sn-share-canvas ${orientation}`}
            />
            <button
              type='button'
              className='sn-share-orientation-float'
              aria-label={orientation === 'portrait' ? '切换为横版海报' : '切换为竖版海报'}
              title={orientation === 'portrait' ? '切换横版' : '切换竖版'}
              onClick={() => setOrientation(current => current === 'portrait' ? 'landscape' : 'portrait')}
            >
              <svg viewBox='0 0 24 24' aria-hidden='true' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round'>
                {orientation === 'portrait'
                  ? <><rect x='7' y='3' width='10' height='18' rx='1.5' /><path d='M10 17h4' /></>
                  : <><rect x='3' y='7' width='18' height='10' rx='1.5' /><path d='M7 12h10' /></>}
              </svg>
            </button>
          </div>

          <div className='sn-share-actions'>
            <button type='button' className='sn-action-btn' onClick={downloadPoster} disabled={!ready}>
              <svg viewBox='0 0 24 24' aria-hidden='true' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
                <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
                <polyline points='7 10 12 15 17 10' />
                <line x1='12' y1='15' x2='12' y2='3' />
              </svg>
              <span>下载海报</span>
            </button>
            <button type='button' className='sn-action-btn' onClick={copyLink}>
              {copied ? (
                <svg viewBox='0 0 24 24' aria-hidden='true' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
                  <polyline points='20 6 9 17 4 12' />
                </svg>
              ) : (
                <svg viewBox='0 0 24 24' aria-hidden='true' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
                  <path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' />
                  <path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' />
                </svg>
              )}
              <span>{copied ? '已复制' : '复制链接'}</span>
            </button>
          </div>
        </div>
      </section>

      <style jsx>{`
        .sn-share-overlay {
          position: fixed;
          inset: 0;
          z-index: 100000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px;
          background: rgba(22, 28, 43, 0.58);
          backdrop-filter: blur(5px);
        }
        .sn-share-dialog {
          max-width: calc(100vw - 20px);
          max-height: calc(100dvh - 20px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid rgba(70, 89, 130, 0.15);
          border-radius: 14px;
          background: #FBFAF7;
          box-shadow: 0 18px 54px rgba(20, 26, 43, 0.24);
          transition: width 160ms ease;
        }
        .sn-share-dialog.portrait { width: min(94vw, 430px); }
        .sn-share-dialog.landscape { width: min(96vw, 790px); }
        .sn-share-header {
          flex: 0 0 auto;
          min-height: 46px;
          padding: 7px 12px 7px 17px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(70, 89, 130, 0.09);
        }
        .sn-share-header h2 {
          margin: 0;
          color: ${THEME.ink};
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.01em;
        }
        .sn-share-close {
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: #66718A;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
        }
        .sn-share-close:hover { background: rgba(70, 89, 130, 0.07); }
        .sn-share-body {
          min-height: 0;
          padding: 12px 14px 9px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 7px;
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        .sn-share-preview {
          position: relative;
          flex: 0 0 auto;
          display: flex;
          justify-content: center;
          align-items: center;
          width: fit-content;
          max-width: 100%;
          line-height: 0;
        }
        .sn-share-canvas {
          display: block;
          width: auto;
          height: auto;
          max-width: 100%;
          max-height: min(68dvh, 680px);
          border-radius: 3px;
          background: ${THEME.paper};
          box-shadow: 0 3px 13px rgba(28, 36, 57, 0.13);
        }
        .sn-share-canvas.portrait {
          max-width: min(100%, 320px);
          max-height: min(68dvh, 610px);
        }
        .sn-share-canvas.landscape {
          max-width: min(100%, 680px);
          max-height: min(64dvh, 455px);
        }
        .sn-share-orientation-float {
          position: absolute;
          right: 8px;
          bottom: 8px;
          z-index: 2;
          width: 33px;
          height: 33px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,0.72);
          border-radius: 50%;
          background: rgba(27, 37, 56, 0.73);
          color: #FFFFFF;
          box-shadow: 0 2px 8px rgba(20, 26, 43, 0.18);
          backdrop-filter: blur(6px);
          cursor: pointer;
          transition: background 0.15s ease, transform 0.15s ease;
        }
        .sn-share-orientation-float:hover { background: rgba(27, 37, 56, 0.9); transform: scale(1.04); }
        .sn-share-orientation-float svg { width: 17px; height: 17px; }
        .sn-share-actions {
          flex: 0 0 auto;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 22px;
          min-height: 31px;
          padding: 1px 0 0;
        }
        .sn-action-btn {
          min-width: 0;
          min-height: 29px;
          padding: 3px 2px;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          gap: 6px;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: #171717;
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          cursor: pointer;
          transition: color 0.15s ease, opacity 0.15s ease;
        }
        .sn-action-btn:hover:not(:disabled) { color: #000000; }
        .sn-action-btn svg { width: 15px; height: 15px; flex: 0 0 auto; }
        .sn-action-btn:disabled { color: #333333; opacity: 0.78; cursor: wait; }
        .sn-action-btn:focus-visible, .sn-share-orientation-float:focus-visible, .sn-share-close:focus-visible {
          outline: 2px solid ${THEME.primary};
          outline-offset: 3px;
        }
        @media (max-width: 600px) {
          .sn-share-overlay { padding: 6px; }
          .sn-share-dialog { max-width: calc(100vw - 12px); max-height: calc(100dvh - 12px); border-radius: 12px; }
          .sn-share-dialog.portrait { width: min(calc(100vw - 12px), 390px); }
          .sn-share-dialog.landscape { width: calc(100vw - 12px); }
          .sn-share-header { min-height: 42px; padding: 6px 9px 6px 13px; }
          .sn-share-body { padding: 8px 7px 7px; gap: 5px; }
          .sn-share-canvas.portrait { max-width: min(100%, 286px); max-height: 62dvh; }
          .sn-share-canvas.landscape { max-width: 100%; max-height: 52dvh; }
          .sn-share-orientation-float { width: 30px; height: 30px; right: 6px; bottom: 6px; }
          .sn-share-actions { gap: 20px; min-height: 28px; }
          .sn-action-btn { min-height: 27px; font-size: 12px; font-weight: 600; }
          .sn-action-btn svg { width: 14px; height: 14px; }
        }
        @media (max-height: 700px) {
          .sn-share-body { padding-top: 6px; padding-bottom: 5px; gap: 4px; }
          .sn-share-canvas.portrait { max-height: 61dvh; }
          .sn-share-canvas.landscape { max-height: 55dvh; }
          .sn-share-actions { min-height: 26px; }
        }
      `}</style>
    </div>
  )
}
