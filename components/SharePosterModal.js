import { useEffect, useRef, useState } from 'react'

const THEME = {
  primary: '#3A4A7A',
  primaryDark: '#27365F',
  paper: '#FBF8F1',
  paperDeep: '#F4EFE5',
  ink: '#26314B',
  muted: '#72798A',
  border: 'rgba(58, 74, 122, 0.34)'
}

// 只使用系统已安装的中文字体，海报生成不依赖外部网页字体。
const POSTER_FONT =
  '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'

const DEFAULT_QR_CDN =
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
const QR_CDN_CANDIDATES = [
  process.env.NEXT_PUBLIC_QR_CODE_CDN,
  DEFAULT_QR_CDN,
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
  'https://unpkg.com/qrcodejs@1.0.0/qrcode.min.js'
].filter((value, index, list) => value && list.indexOf(value) === index)

const qrScriptPromises = new Map()
const coverImagePromises = new Map()

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
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

function fillRoundedRect(ctx, x, y, width, height, radius, color) {
  roundedRectPath(ctx, x, y, width, height, radius)
  ctx.fillStyle = color
  ctx.fill()
}

function strokeRoundedRect(ctx, x, y, width, height, radius, color, lineWidth = 2) {
  roundedRectPath(ctx, x, y, width, height, radius)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

function getEpisodeNumber(post) {
  const candidate = String(post?.slug || post?.url || '')
  const match = candidate.match(/(\d+)(?!.*\d)/)
  return match ? `EP.${match[1]}` : ''
}

function plainText(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeImageUrl(value, seen = new Set()) {
  if (!value) return ''

  if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw) return ''
    try {
      const url = new URL(raw, typeof window !== 'undefined' ? window.location.href : 'https://na.885111.xyz/')
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.href
    } catch {}
    return ''
  }

  if (typeof value !== 'object' || seen.has(value)) return ''
  seen.add(value)

  // 兼容 NotionNext 的字符串封面，以及外部导入数据里常见的 url/src/external/file 对象。
  const keys = ['url', 'src', 'originalUrl', 'original_url', 'external', 'file', 'image', 'cover']
  for (const key of keys) {
    if (value[key]) {
      const result = normalizeImageUrl(value[key], seen)
      if (result) return result
    }
  }
  return ''
}

function getCoverCandidates(post) {
  const values = [
    post?.pageCover,
    post?.pageCoverThumbnail,
    post?.cover,
    post?.coverUrl,
    post?.cover_url,
    post?.thumbnail,
    post?.image,
    post?.properties?.Cover,
    post?.properties?.cover
  ]
  const candidates = []
  values.forEach(value => {
    const url = normalizeImageUrl(value)
    if (url && !candidates.includes(url)) candidates.push(url)
  })
  return candidates.slice(0, 6)
}

function loadSingleImage(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (!url || typeof window === 'undefined') {
      reject(new Error('封面地址为空'))
      return
    }

    const image = new window.Image()
    let settled = false
    const timeoutId = window.setTimeout(() => finish(new Error('图片加载超时')), timeoutMs)

    const finish = (error, result) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      image.onload = null
      image.onerror = null
      if (error) reject(error)
      else resolve(result)
    }

    image.decoding = 'async'
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) finish(null, image)
      else finish(new Error('图片没有有效尺寸'))
    }
    image.onerror = () => finish(new Error('图片地址无法读取'))

    try {
      const parsed = new URL(url, window.location.href)
      // 必须在设置 src 之前设置 crossOrigin，确保成功加载后可以安全绘制到可导出的 Canvas。
      if (parsed.origin !== window.location.origin) image.crossOrigin = 'anonymous'
      image.src = parsed.href
    } catch (error) {
      finish(error instanceof Error ? error : new Error('无效的封面地址'))
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

async function tryLoadCoverCandidate(source, deadline) {
  const isSameOrigin = (() => {
    try {
      return new URL(source).origin === window.location.origin
    } catch {
      return false
    }
  })()

  const attempts = [source]
  if (!isSameOrigin) attempts.push(...getProxyUrls(source))

  let lastError = null
  for (const attempt of attempts) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    // 给每次尝试独立计时；不再使用会把直连和代理重试一起截断的单一 6 秒计时器。
    const timeoutMs = Math.max(700, Math.min(attempt === source ? 3200 : 4200, remaining))
    try {
      return await loadSingleImage(attempt, timeoutMs)
    } catch (error) {
      lastError = error
    }
  }
  if (lastError) throw lastError
  throw new Error('没有可用的封面地址')
}

async function loadCoverImage(post) {
  const candidates = getCoverCandidates(post)
  if (!candidates.length) return null

  const cacheKey = candidates.join('|')
  if (coverImagePromises.has(cacheKey)) return coverImagePromises.get(cacheKey)

  const imagePromise = (async () => {
    // 总耗时设上限，避免单个失效地址让分享窗口长时间无法完成渲染。
    const deadline = Date.now() + 16000
    for (const source of candidates) {
      if (Date.now() >= deadline) break
      try {
        const image = await tryLoadCoverCandidate(source, deadline)
        if (image) return image
      } catch (error) {
        // 继续尝试下一个封面候选；最后失败由占位图兜底。
        if (typeof console !== 'undefined' && process.env.NODE_ENV !== 'production') {
          console.warn('[SharePoster] 封面候选加载失败：', source, error)
        }
      }
    }
    return null
  })()

  coverImagePromises.set(cacheKey, imagePromise)
  const image = await imagePromise
  if (!image) coverImagePromises.delete(cacheKey)
  return image
}

function drawCroppedImage(ctx, image, x, y, width, height, radius) {
  if (!image) return false
  const naturalWidth = image.naturalWidth || image.width
  const naturalHeight = image.naturalHeight || image.height
  if (!naturalWidth || !naturalHeight) return false

  ctx.save()
  roundedRectPath(ctx, x, y, width, height, radius)
  ctx.clip()
  const scale = Math.max(width / naturalWidth, height / naturalHeight)
  const drawWidth = naturalWidth * scale
  const drawHeight = naturalHeight * scale
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight)
  ctx.restore()
  return true
}

function drawCoverPlaceholder(ctx, x, y, width, height, radius) {
  ctx.save()
  roundedRectPath(ctx, x, y, width, height, radius)
  ctx.clip()
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height)
  gradient.addColorStop(0, '#E6E9F0')
  gradient.addColorStop(1, '#D6DCE8')
  ctx.fillStyle = gradient
  ctx.fillRect(x, y, width, height)
  ctx.fillStyle = THEME.primary
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${Math.max(28, Math.min(48, width * 0.075))}px ${POSTER_FONT}`
  ctx.fillText('念安酒馆', x + width / 2, y + height / 2 - 15)
  ctx.font = `400 ${Math.max(16, Math.min(24, width * 0.035))}px ${POSTER_FONT}`
  ctx.fillStyle = '#616D88'
  ctx.fillText('声音明信片', x + width / 2, y + height / 2 + 30)
  ctx.restore()
}

function drawPaperBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#FFFCF6')
  gradient.addColorStop(1, THEME.paperDeep)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  strokeRoundedRect(ctx, 42, 42, width - 84, height - 84, 16, THEME.border, 3)
  strokeRoundedRect(ctx, 54, 54, width - 108, height - 108, 12, 'rgba(58, 74, 122, 0.10)', 1)
}

function drawHeader(ctx, width, y = 82) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = THEME.ink
  ctx.font = `600 48px ${POSTER_FONT}`
  ctx.fillText('念安酒馆', width / 2, y)

  ctx.font = `400 25px ${POSTER_FONT}`
  ctx.fillStyle = THEME.primary
  ctx.fillText('声 音 明 信 片', width / 2, y + 60)

  ctx.strokeStyle = 'rgba(58, 74, 122, 0.28)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(width / 2 - 230, y + 76)
  ctx.lineTo(width / 2 - 105, y + 76)
  ctx.moveTo(width / 2 + 105, y + 76)
  ctx.lineTo(width / 2 + 230, y + 76)
  ctx.stroke()
}

function wrapAndDrawText(ctx, rawText, x, y, maxWidth, lineHeight, maxLines, align = 'left') {
  const text = plainText(rawText)
  if (!text) return { nextY: y, lineCount: 0 }

  ctx.textAlign = align
  ctx.textBaseline = 'top'
  const lines = []
  let line = ''
  for (const character of Array.from(text)) {
    const next = line + character
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = character
    } else {
      line = next
    }
  }
  if (line) lines.push(line)

  const truncated = lines.length > maxLines
  const visibleLines = lines.slice(0, maxLines)
  if (truncated && visibleLines.length) {
    let lastLine = visibleLines[visibleLines.length - 1]
    while (lastLine && ctx.measureText(`${lastLine}…`).width > maxWidth) {
      lastLine = lastLine.slice(0, -1)
    }
    visibleLines[visibleLines.length - 1] = `${lastLine.trimEnd()}…`
  }

  visibleLines.forEach((lineText, index) => {
    ctx.fillText(lineText, x, y + index * lineHeight)
  })

  return { nextY: y + visibleLines.length * lineHeight, lineCount: visibleLines.length }
}

function drawDuration(ctx, x, y, duration) {
  if (!duration) return
  fillRoundedRect(ctx, x, y, 112, 38, 19, 'rgba(20, 28, 45, 0.78)')
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.moveTo(x + 15, y + 11)
  ctx.lineTo(x + 15, y + 27)
  ctx.lineTo(x + 27, y + 19)
  ctx.closePath()
  ctx.fill()
  ctx.font = `500 17px ${POSTER_FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(duration, x + 36, y + 19)
}

async function loadQrScript(url) {
  if (typeof window === 'undefined') throw new Error('当前环境无法生成二维码')
  if (typeof window.QRCode === 'function') return
  if (qrScriptPromises.has(url)) return qrScriptPromises.get(url)

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    let settled = false
    const timer = window.setTimeout(() => finish(new Error('二维码脚本加载超时')), 5500)
    const finish = error => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      script.onload = null
      script.onerror = null
      if (error) reject(error)
      else if (typeof window.QRCode === 'function') resolve()
      else reject(new Error('二维码脚本未提供 QRCode'))
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
    let loaded = false
    for (const url of QR_CDN_CANDIDATES) {
      try {
        await loadQrScript(url)
        QRCodeConstructor = window.QRCode
        loaded = typeof QRCodeConstructor === 'function'
        if (loaded) break
      } catch {}
    }
    if (!loaded) return null
  }

  try {
    const host = document.createElement('div')
    new QRCodeConstructor(host, {
      text: value,
      width: 256,
      height: 256,
      colorDark: '#172033',
      colorLight: '#FFFFFF',
      correctLevel: QRCodeConstructor.CorrectLevel?.H ?? 2
    })

    const directCanvas = host.querySelector('canvas')
    if (directCanvas) return directCanvas

    const image = host.querySelector('img')
    if (image) {
      if (!image.complete || image.naturalWidth === 0) {
        await new Promise((resolve, reject) => {
          const timer = window.setTimeout(() => reject(new Error('二维码生成超时')), 2500)
          image.onload = () => { window.clearTimeout(timer); resolve() }
          image.onerror = () => { window.clearTimeout(timer); reject(new Error('二维码图像生成失败')) }
        })
      }
      if (image.naturalWidth > 0) {
        const qrCanvas = document.createElement('canvas')
        qrCanvas.width = 256
        qrCanvas.height = 256
        const qrContext = qrCanvas.getContext('2d')
        if (qrContext) {
          qrContext.fillStyle = '#FFFFFF'
          qrContext.fillRect(0, 0, 256, 256)
          qrContext.drawImage(image, 0, 0, 256, 256)
          return qrCanvas
        }
      }
    }
  } catch (error) {
    if (typeof console !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.warn('[SharePoster] 二维码生成失败：', error)
    }
  }
  return null
}

function drawQrAndBrand(ctx, qrCanvas, qrX, qrY, qrSize, brandX, brandY, brandMaxWidth) {
  if (qrCanvas) {
    fillRoundedRect(ctx, qrX - 7, qrY - 7, qrSize + 14, qrSize + 14, 10, '#FFFFFF')
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)
    strokeRoundedRect(ctx, qrX - 7, qrY - 7, qrSize + 14, qrSize + 14, 10, 'rgba(58, 74, 122, 0.16)', 1)
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = THEME.ink
  ctx.font = `600 29px ${POSTER_FONT}`
  ctx.fillText('念安酒馆', brandX, brandY)
  ctx.fillStyle = THEME.primary
  ctx.font = `400 22px ${POSTER_FONT}`
  wrapAndDrawText(ctx, '声音明信片', brandX, brandY + 42, brandMaxWidth, 30, 1, 'left')
}

async function buildPoster({ post, shareUrl, orientation, duration }) {
  const landscape = orientation === 'landscape'
  const width = landscape ? 1440 : 1080
  const height = landscape ? 1080 : 1440
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 初始化失败')
  drawPaperBackground(ctx, width, height)
  const [coverImage, qrCanvas] = await Promise.all([
    loadCoverImage(post),
    createQrCanvas(shareUrl).catch(() => null)
  ])

  const title = plainText(post?.title) || '这一期，等你来听'
  const summary = plainText(post?.summary || post?.description || post?.excerpt || '')
  const meta = [
    getEpisodeNumber(post),
    plainText(post?.category || post?.type),
    plainText(post?.publishDay || post?.date)
  ].filter(Boolean).join('  ·  ')

  // 封面始终位于海报上半部；下半部只保留标题、简介、必要元信息和品牌落款。
  if (!landscape) {
    const inset = 68
    const coverX = inset
    const coverY = 68
    const coverWidth = width - inset * 2
    const coverHeight = 690
    if (!drawCroppedImage(ctx, coverImage, coverX, coverY, coverWidth, coverHeight, 10)) {
      drawCoverPlaceholder(ctx, coverX, coverY, coverWidth, coverHeight, 10)
    }
    if (duration) drawDuration(ctx, coverX + 18, coverY + coverHeight - 54, duration)

    let currentY = 800
    ctx.fillStyle = THEME.ink
    ctx.font = `600 43px ${POSTER_FONT}`
    const titleResult = wrapAndDrawText(ctx, title, inset + 2, currentY, width - inset * 2 - 4, 57, 2, 'left')
    currentY = titleResult.nextY + 17

    if (meta) {
      ctx.fillStyle = THEME.primary
      ctx.font = `400 22px ${POSTER_FONT}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(meta, inset + 2, currentY)
      currentY += 40
    }

    if (summary) {
      ctx.fillStyle = THEME.muted
      ctx.font = `400 25px ${POSTER_FONT}`
      wrapAndDrawText(ctx, summary, inset + 2, currentY, width - inset * 2 - 4, 37, 3, 'left')
    }

    ctx.strokeStyle = 'rgba(58, 74, 122, 0.18)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(inset, 1260)
    ctx.lineTo(width - inset, 1260)
    ctx.stroke()
    drawQrAndBrand(ctx, qrCanvas, width - inset - 112, 1284, 96, inset + 2, 1300, 500)
  } else {
    const inset = 58
    const coverX = inset
    const coverY = 58
    const coverWidth = width - inset * 2
    const coverHeight = 500
    if (!drawCroppedImage(ctx, coverImage, coverX, coverY, coverWidth, coverHeight, 10)) {
      drawCoverPlaceholder(ctx, coverX, coverY, coverWidth, coverHeight, 10)
    }
    if (duration) drawDuration(ctx, coverX + 18, coverY + coverHeight - 54, duration)

    const textX = inset + 4
    const textWidth = width - inset * 2 - 8
    let currentY = 598
    ctx.fillStyle = THEME.ink
    ctx.font = `600 39px ${POSTER_FONT}`
    const titleResult = wrapAndDrawText(ctx, title, textX, currentY, textWidth, 50, 2, 'left')
    currentY = titleResult.nextY + 12

    if (meta) {
      ctx.fillStyle = THEME.primary
      ctx.font = `400 20px ${POSTER_FONT}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(meta, textX, currentY)
      currentY += 34
    }

    if (summary) {
      ctx.fillStyle = THEME.muted
      ctx.font = `400 22px ${POSTER_FONT}`
      wrapAndDrawText(ctx, summary, textX, currentY, textWidth - 4, 31, 2, 'left')
    }

    ctx.strokeStyle = 'rgba(58, 74, 122, 0.18)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(inset, 900)
    ctx.lineTo(width - inset, 900)
    ctx.stroke()
    drawQrAndBrand(ctx, qrCanvas, width - inset - 108, 920, 88, inset + 4, 934, 600)
  }

  return { canvas, coverLoaded: !!coverImage, qrReady: !!qrCanvas }
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
    if (!open) return
    const audioEl = document.querySelector('audio')
    if (audioEl && Number.isFinite(audioEl.duration) && audioEl.duration > 0) {
      const minutes = Math.floor(audioEl.duration / 60)
      const seconds = Math.floor(audioEl.duration % 60)
      setDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`)
    } else {
      setDuration('')
    }
  }, [open, post])

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    setReady(false)

    buildPoster({ post, shareUrl, orientation, duration })
      .then(result => {
        if (cancelled || !canvasRef.current) return
        const visibleCanvas = canvasRef.current
        visibleCanvas.width = result.canvas.width
        visibleCanvas.height = result.canvas.height
        const ctx = visibleCanvas.getContext('2d')
        if (!ctx) throw new Error('Canvas 初始化失败')
        ctx.clearRect(0, 0, visibleCanvas.width, visibleCanvas.height)
        ctx.drawImage(result.canvas, 0, 0)
        setReady(true)
      })
      .catch(error => {
        if (cancelled) return
        setReady(false)
        if (typeof console !== 'undefined') console.error('[SharePoster] 海报生成失败：', error)
      })

    return () => { cancelled = true }
  }, [open, orientation, shareUrl, duration, post])

  useEffect(() => {
    if (open) setCopied(false)
  }, [open])

  if (!open) return null

  const copyLink = async () => {
    const value = shareUrl || (typeof window !== 'undefined' ? window.location.href : '')
    if (!value) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        throw new Error('Clipboard API unavailable')
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
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
          window.setTimeout(() => setCopied(false), 1800)
        }
      } catch (error) {
        if (typeof console !== 'undefined') console.error('[SharePoster] 复制链接失败：', error)
      }
    }
  }

  const downloadPoster = async () => {
    const canvas = canvasRef.current
    if (!canvas || !ready) return
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      if (blob) {
        const downloadUrl = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = downloadUrl
        anchor.download = `${safeFileName(post?.title)}.png`
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500)
        return
      }

      const dataUrl = canvas.toDataURL('image/png')
      const anchor = document.createElement('a')
      anchor.href = dataUrl
      anchor.download = `${safeFileName(post?.title)}.png`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    } catch (error) {
      if (typeof console !== 'undefined') console.error('[SharePoster] 下载海报失败：', error)
    }
  }

  return (
    <div
      className='sn-share-overlay'
      role='presentation'
      onMouseDown={event => event.target === event.currentTarget && onClose?.()}
    >
      <section className='sn-share-dialog' role='dialog' aria-modal='true' aria-labelledby='sn-share-title'>
        <header className='sn-share-header'>
          <h2 id='sn-share-title'>分享这一期</h2>
          <button type='button' className='sn-share-close' aria-label='关闭' onClick={onClose}>×</button>
        </header>

        <div className='sn-share-body'>
          <div className={`sn-share-preview ${orientation}`}>
            <canvas
              ref={canvasRef}
              aria-label='节目分享海报预览'
              className={`sn-share-canvas ${orientation}`}
            />
            <button
              type='button'
              className='sn-share-orientation-float'
              aria-label={orientation === 'portrait' ? '切换为横版海报' : '切换为竖版海报'}
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
            <button type='button' className='sn-action-btn sn-action-primary' onClick={downloadPoster} disabled={!ready}>
              <svg viewBox='0 0 24 24' aria-hidden='true' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
                <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
                <polyline points='7 10 12 15 17 10' />
                <line x1='12' y1='15' x2='12' y2='3' />
              </svg>
              <span>下载海报</span>
            </button>
            <button type='button' className='sn-action-btn sn-action-secondary' onClick={copyLink}>
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
              <span>复制链接</span>
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
          padding: 12px;
          background: rgba(22, 28, 43, 0.58);
          backdrop-filter: blur(5px);
        }
        .sn-share-dialog {
          width: min(100%, 680px);
          max-height: calc(100dvh - 24px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid rgba(58, 74, 122, 0.13);
          border-radius: 15px;
          background: #FBFAF6;
          box-shadow: 0 18px 56px rgba(20, 26, 43, 0.22);
        }
        .sn-share-header {
          flex: 0 0 auto;
          min-height: 48px;
          padding: 8px 14px 8px 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(58, 74, 122, 0.10);
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
          color: #687189;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
        }
        .sn-share-close:hover { background: rgba(58, 74, 122, 0.07); }
        .sn-share-body {
          min-height: 0;
          padding: 12px 16px 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        .sn-share-preview {
          position: relative;
          width: fit-content;
          max-width: 100%;
          min-height: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          line-height: 0;
        }
        .sn-share-canvas {
          display: block;
          width: auto;
          height: auto;
          max-width: 100%;
          max-height: min(66dvh, 690px);
          background: ${THEME.paper};
          border-radius: 3px;
          box-shadow: 0 3px 12px rgba(28, 36, 57, 0.12);
        }
        .sn-share-canvas.portrait { max-width: min(100%, 350px); }
        .sn-share-canvas.landscape { max-width: min(100%, 590px); }
        .sn-share-orientation-float {
          position: absolute;
          right: 9px;
          bottom: 9px;
          z-index: 2;
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,0.78);
          border-radius: 50%;
          background: rgba(34, 43, 65, 0.72);
          color: #FFFFFF;
          box-shadow: 0 2px 8px rgba(20, 26, 43, 0.18);
          backdrop-filter: blur(5px);
          cursor: pointer;
          transition: background 0.15s ease, transform 0.15s ease;
        }
        .sn-share-orientation-float:hover { background: rgba(34, 43, 65, 0.88); transform: scale(1.04); }
        .sn-share-orientation-float svg { width: 17px; height: 17px; }
        .sn-share-actions {
          width: auto;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 22px;
          padding: 1px 0 0;
        }
        .sn-action-btn {
          min-width: 0;
          min-height: 30px;
          padding: 3px 2px;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          gap: 6px;
          border: 0;
          border-radius: 0;
          background: transparent;
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
          cursor: pointer;
          transition: color 0.15s ease, opacity 0.15s ease;
        }
        .sn-action-btn svg { width: 16px; height: 16px; flex: 0 0 auto; }
        .sn-action-primary { color: ${THEME.primary}; }
        .sn-action-primary:hover:not(:disabled) { color: ${THEME.primaryDark}; }
        .sn-action-secondary { color: #6B7280; }
        .sn-action-secondary:hover { color: ${THEME.primary}; }
        .sn-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .sn-action-btn:focus-visible, .sn-share-orientation-float:focus-visible, .sn-share-close:focus-visible {
          outline: 2px solid ${THEME.primary};
          outline-offset: 3px;
        }
        @media (max-width: 600px) {
          .sn-share-overlay { padding: 6px; }
          .sn-share-dialog { width: 100%; max-height: calc(100dvh - 12px); border-radius: 12px; }
          .sn-share-header { min-height: 44px; padding: 7px 10px 7px 14px; }
          .sn-share-body { padding: 9px 8px 10px; gap: 8px; }
          .sn-share-canvas { max-height: min(67dvh, 610px); }
          .sn-share-canvas.portrait { max-width: min(calc(100vw - 34px), 330px); }
          .sn-share-canvas.landscape { max-width: calc(100vw - 28px); }
          .sn-share-orientation-float { width: 31px; height: 31px; right: 7px; bottom: 7px; }
          .sn-share-actions { gap: 20px; }
          .sn-action-btn { min-height: 28px; font-size: 12px; }
          .sn-action-btn svg { width: 15px; height: 15px; }
        }
        @media (max-height: 700px) {
          .sn-share-body { gap: 7px; padding-top: 8px; padding-bottom: 9px; }
          .sn-share-canvas { max-height: 58dvh; }
        }
      `}</style>
    </div>
  )
}
