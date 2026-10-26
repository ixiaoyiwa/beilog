import { useEffect, useRef, useState } from 'react'
import { loadExternalResource } from '@/lib/utils'
import { siteConfig } from '@/lib/config'

const QR_CODE_CDN =
  process.env.NEXT_PUBLIC_QR_CODE_CDN ||
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'

const POSTER_FONT =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif'

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

function getThemeColor() {
  if (typeof window === 'undefined') return '#928CEE'
  const themeRoot = document.querySelector('#theme-hexo') || document.documentElement
  const value = window.getComputedStyle(themeRoot).getPropertyValue('--theme-color').trim()
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : '#928CEE'
}

function getEpisodeNumber(post) {
  const slug = String(post?.slug || '')
  const match = slug.match(/(\d+)(?!.*\d)/)
  return match ? `EP ${match[1]}` : ''
}

function wrapAndDrawText(ctx, rawText, x, y, maxWidth, lineHeight, maxLines) {
  const text = String(rawText || '').replace(/\s+/g, ' ').trim()
  if (!text) return { nextY: y, lineCount: 0 }

  const characters = Array.from(text)
  const allLines = []
  let line = ''

  characters.forEach(character => {
    const candidate = line + character
    if (line && ctx.measureText(candidate).width > maxWidth) {
      allLines.push(line)
      line = character
    } else {
      line = candidate
    }
  })
  if (line) allLines.push(line)

  const truncated = allLines.length > maxLines
  const lines = allLines.slice(0, maxLines)
  if (truncated && lines.length > 0) {
    let lastLine = lines[lines.length - 1]
    while (lastLine.length > 0 && ctx.measureText(`${lastLine}…`).width > maxWidth) {
      lastLine = lastLine.slice(0, -1)
    }
    lines[lines.length - 1] = `${lastLine.trimEnd()}…`
  }

  ctx.textBaseline = 'top'
  lines.forEach((textLine, index) => {
    ctx.fillText(textLine, x, y + index * lineHeight)
  })

  return {
    nextY: y + lines.length * lineHeight,
    lineCount: lines.length
  }
}

function loadCoverImage(source) {
  if (!source || typeof window === 'undefined') return Promise.resolve(null)

  return new Promise(resolve => {
    const image = new window.Image()
    let settled = false
    const finish = value => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      resolve(value)
    }
    const timeoutId = window.setTimeout(() => finish(null), 8000)
    try {
      const parsed = new URL(source, window.location.href)
      if (/^https?:$/.test(parsed.protocol) && parsed.origin !== window.location.origin) {
        image.crossOrigin = 'anonymous'
      }
    } catch {}
    image.onload = () => finish(image)
    image.onerror = () => finish(null)
    image.src = source
    if (image.complete && image.naturalWidth > 0) finish(image)
  })
}

function drawCroppedImage(ctx, image, x, y, width, height, radius) {
  ctx.save()
  roundedRectPath(ctx, x, y, width, height, radius)
  ctx.clip()
  const scale = Math.max(width / image.width, height / image.height)
  const drawWidth = image.width * scale
  const drawHeight = image.height * scale
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight)
  ctx.restore()
}

function drawCoverPlaceholder(ctx, x, y, width, height, radius, accent) {
  fillRoundedRect(ctx, x, y, width, height, radius, '#EEEAF4')
  ctx.save()
  roundedRectPath(ctx, x, y, width, height, radius)
  ctx.clip()
  ctx.globalAlpha = 0.18
  ctx.strokeStyle = accent
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  const centerY = y + height * 0.48
  for (let wave = 0; wave < 3; wave++) {
    ctx.beginPath()
    for (let step = 0; step <= 100; step++) {
      const px = x + (step / 100) * width
      const py = centerY + Math.sin(step * 0.18 + wave * 0.85) * (height * 0.09)
      if (step === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = '#4B465F'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${Math.max(26, Math.min(42, width * 0.055))}px ${POSTER_FONT}`
  ctx.fillText('念安酒馆', x + width / 2, y + height * 0.76)
  ctx.restore()
}

async function createQrCanvas(value) {
  await loadExternalResource(QR_CODE_CDN, 'js')
  const QRCodeConstructor = typeof window !== 'undefined' ? window.QRCode : null
  if (typeof QRCodeConstructor !== 'function') throw new Error('二维码脚本加载后未找到 QRCode')

  const host = document.createElement('div')
  const qrCode = new QRCodeConstructor(host, {
    text: value,
    width: 256,
    height: 256,
    colorDark: '#202020',
    colorLight: '#FFFFFF',
    correctLevel: QRCodeConstructor.CorrectLevel?.H ?? 2
  })

  let sourceCanvas = host.querySelector('canvas')
  if (!sourceCanvas) {
    const image = host.querySelector('img')
    if (image) {
      if (!image.complete) {
        await new Promise((resolve, reject) => {
          image.onload = resolve
          image.onerror = reject
          window.setTimeout(resolve, 1500)
        })
      }
      if (image.complete && image.naturalWidth > 0) {
        sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = 256
        sourceCanvas.height = 256
        sourceCanvas.getContext('2d').drawImage(image, 0, 0, 256, 256)
      }
    }
  }

  if (!sourceCanvas) {
    if (qrCode && typeof qrCode.clear === 'function') qrCode.clear()
    throw new Error('没有生成二维码画布')
  }
  return sourceCanvas
}

function drawQrBlock(ctx, qrCanvas, x, y, size, accent, landscape) {
  fillRoundedRect(ctx, x, y, size, size, 18, '#FFFFFF')
  strokeRoundedRect(ctx, x, y, size, size, 18, accent, 2)
  if (qrCanvas) {
    const padding = Math.round(size * 0.105)
    ctx.drawImage(qrCanvas, x + padding, y + padding, size - padding * 2, size - padding * 2)
  } else {
    ctx.fillStyle = '#6B7280'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `500 ${landscape ? 18 : 16}px ${POSTER_FONT}`
    ctx.fillText('二维码暂不可用', x + size / 2, y + size / 2)
  }
}

async function drawPoster({ canvas, post, shareUrl, orientation }) {
  const landscape = orientation === 'landscape'
  const width = landscape ? 1440 : 1080
  const height = landscape ? 1080 : 1440
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('浏览器无法创建 Canvas')

  const accent = getThemeColor()
  const brand = siteConfig('TITLE') || '念安酒馆'
  const title = String(post?.title || '这一期，等你来听')
  const summary = String(post?.summary || '听有你的故事，等有故事的你。')
  const coverSource = post?.pageCoverThumbnail || post?.pageCover || ''
  const episodeNumber = getEpisodeNumber(post)
  const category = String(post?.category || '')
  const date = String(post?.publishDay || post?.date || '')
  const meta = [episodeNumber, category, date].filter(Boolean).join('　·　')

  ctx.fillStyle = '#F8F5EF'
  ctx.fillRect(0, 0, width, height)
  fillRoundedRect(ctx, 28, 28, width - 56, height - 56, 25, '#FFFEFC')
  strokeRoundedRect(ctx, 28, 28, width - 56, height - 56, 25, accent, 3)
  strokeRoundedRect(ctx, 43, 43, width - 86, height - 86, 18, `${accent}55`, 1)

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#34313A'
  ctx.font = `700 32px ${POSTER_FONT}`
  ctx.fillText(brand, 78, 92)
  ctx.textAlign = 'right'
  ctx.fillStyle = accent
  ctx.font = `500 23px ${POSTER_FONT}`
  ctx.fillText('声音明信片', width - 78, 92)
  ctx.strokeStyle = `${accent}70`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(78, 130)
  ctx.lineTo(width - 78, 130)
  ctx.stroke()

  let coverLoaded = false
  const coverImage = await loadCoverImage(coverSource)
  if (coverImage) coverLoaded = true

  let qrCanvas = null
  try {
    qrCanvas = await createQrCanvas(shareUrl)
  } catch {
    qrCanvas = null
  }

  if (!landscape) {
    const coverX = 78, coverY = 164, coverW = 924, coverH = 420
    if (coverImage) drawCroppedImage(ctx, coverImage, coverX, coverY, coverW, coverH, 18)
    else drawCoverPlaceholder(ctx, coverX, coverY, coverW, coverH, 18, accent)

    ctx.textAlign = 'left'
    ctx.fillStyle = '#26232B'
    ctx.font = `700 49px ${POSTER_FONT}`
    const titleResult = wrapAndDrawText(ctx, title, 80, 632, 920, 60, 2)

    let metaY = Math.max(770, titleResult.nextY + 22)
    if (meta) {
      ctx.fillStyle = accent
      ctx.font = `500 22px ${POSTER_FONT}`
      ctx.fillText(meta.length > 54 ? `${meta.slice(0, 53)}…` : meta, 82, metaY)
    }

    const summaryY = metaY + 36
    ctx.fillStyle = '#5C5861'
    ctx.font = `400 27px ${POSTER_FONT}`
    wrapAndDrawText(ctx, summary, 82, summaryY, 870, 38, 4)

    drawQrBlock(ctx, qrCanvas, 812, 1138, 190, accent, false)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#34313A'
    ctx.font = `600 25px ${POSTER_FONT}`
    ctx.fillText('听有你的故事，等有故事的你。', 82, 1210)
    ctx.fillStyle = '#85808A'
    ctx.font = `400 21px ${POSTER_FONT}`
    ctx.fillText('扫码收听这一期', 812, 1350)
    ctx.textAlign = 'left'
    ctx.fillText(new URL(shareUrl).host, 82, 1340)
  } else {
    const coverX = 78, coverY = 190, coverSize = 470
    if (coverImage) drawCroppedImage(ctx, coverImage, coverX, coverY, coverSize, coverSize, 18)
    else drawCoverPlaceholder(ctx, coverX, coverY, coverSize, coverSize, 18, accent)

    ctx.textAlign = 'left'
    ctx.fillStyle = '#26232B'
    ctx.font = `700 48px ${POSTER_FONT}`
    const titleResult = wrapAndDrawText(ctx, title, 610, 204, 730, 60, 3)
    const metaY = Math.max(410, titleResult.nextY + 22)

    if (meta) {
      ctx.fillStyle = accent
      ctx.font = `500 22px ${POSTER_FONT}`
      ctx.fillText(meta.length > 46 ? `${meta.slice(0, 45)}…` : meta, 612, metaY)
    }

    ctx.fillStyle = '#5C5861'
    ctx.font = `400 27px ${POSTER_FONT}`
    wrapAndDrawText(ctx, summary, 612, metaY + 44, 700, 39, 5)

    ctx.fillStyle = '#34313A'
    ctx.font = `600 25px ${POSTER_FONT}`
    ctx.fillText('听有你的故事，等有故事的你。', 610, 790)
    ctx.fillStyle = '#85808A'
    ctx.font = `400 21px ${POSTER_FONT}`
    ctx.fillText(new URL(shareUrl).host, 612, 834)

    drawQrBlock(ctx, qrCanvas, 1130, 740, 190, accent, true)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#5C5861'
    ctx.font = `400 20px ${POSTER_FONT}`
    ctx.fillText('扫码收听这一期', 1225, 956)
  }

  return { qrReady: !!qrCanvas, coverLoaded, hasCover: !!coverSource }
}

function safeFileName(value) {
  return String(value || '念安酒馆-声音明信片').replace(/[\\/:*?"<>|\u0000-\u001F]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || '念安酒馆-声音明信片'
}

export default function SharePosterModal({ open, onClose, post, shareUrl }) {
  const canvasRef = useRef(null)
  const [orientation, setOrientation] = useState('portrait')
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = event => { if (event.key === 'Escape') onClose?.() }
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
    const canvas = canvasRef.current
    if (!canvas) return undefined

    setReady(false)
    setStatus('正在生成海报预览…')
    drawPoster({ canvas, post, shareUrl, orientation }).then(result => {
      if (cancelled) return
      setReady(result.qrReady)
      if (!result.qrReady) setStatus('二维码资源加载失败。请检查二维码 CDN；复制链接仍可使用。')
      else if (result.hasCover && !result.coverLoaded) setStatus('封面图受跨域限制或暂时无法读取，已用主题色占位；海报仍可下载。')
      else setStatus('')
    }).catch(() => {
      if (cancelled) return
      setReady(false)
      setStatus('海报生成失败，请刷新页面后重试；你仍然可以复制节目链接。')
    })

    return () => { cancelled = true }
  }, [open, orientation, shareUrl, post?.title, post?.summary, post?.pageCover, post?.pageCoverThumbnail, post?.slug, post?.category, post?.date, post?.publishDay])

  if (!open) return null

  const copyLink = async () => {
    const value = shareUrl || (typeof window !== 'undefined' ? window.location.href : '')
    if (!value) { setStatus('暂时无法获取当前节目链接。'); return }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value)
      else throw new Error('Clipboard API unavailable')
      setStatus('节目链接已复制。')
    } catch {
      try {
        const input = document.createElement('textarea')
        input.value = value
        input.setAttribute('readonly', '')
        input.style.position = 'fixed'
        input.style.opacity = '0'
        input.style.pointerEvents = 'none'
        document.body.appendChild(input)
        input.select()
        const copied = document.execCommand('copy')
        input.remove()
        setStatus(copied ? '节目链接已复制。' : '复制未成功，请手动复制下方链接。')
      } catch { setStatus('复制未成功，请手动复制下方链接。') }
    }
  }

  const downloadPoster = async () => {
    const canvas = canvasRef.current
    if (!canvas || !ready) return
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      let downloadUrl
      if (blob) downloadUrl = URL.createObjectURL(blob)
      else downloadUrl = canvas.toDataURL('image/png')
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = `${safeFileName(post?.title)}-${orientation === 'portrait' ? '竖版' : '横版'}.png`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      if (blob) window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
      setStatus('海报已开始下载。')
    } catch { setStatus('图片无法导出。请检查封面图跨域设置后重试。') }
  }

  const title = siteConfig('TITLE') || '念安酒馆'

  return (
    <div className='sn-share-overlay' role='presentation' onMouseDown={event => { if (event.target === event.currentTarget) onClose?.() }}>
      <section className='sn-share-dialog' role='dialog' aria-modal='true' aria-label='分享节目与下载海报'>
        <header className='sn-share-header'>
          <div>
            <h2>分享这一期</h2>
            <p>把喜欢的故事，留成一张声音明信片。</p>
          </div>
          <button className='sn-share-close' type='button' aria-label='关闭' onClick={onClose}>×</button>
        </header>

        <div className='sn-share-content'>
          <div className='sn-share-preview' aria-label='海报预览'>
            <canvas ref={canvasRef} className={`sn-share-canvas ${orientation === 'landscape' ? 'is-landscape' : 'is-portrait'}`} />
          </div>

          <aside className='sn-share-controls'>
            <div className='sn-share-brand'>{title}</div>
            <p className='sn-share-control-label'>海报方向</p>
            <div className='sn-share-orientation' role='group' aria-label='选择海报方向'>
              <button type='button' className={orientation === 'portrait' ? 'is-active' : ''} aria-pressed={orientation === 'portrait'} onClick={() => setOrientation('portrait')}>竖版</button>
              <button type='button' className={orientation === 'landscape' ? 'is-active' : ''} aria-pressed={orientation === 'landscape'} onClick={() => setOrientation('landscape')}>横版</button>
            </div>

            <button className='sn-share-primary' type='button' onClick={downloadPoster} disabled={!ready}>
              <span aria-hidden='true'>↓</span> 下载海报 PNG
            </button>
            <button className='sn-share-secondary' type='button' onClick={copyLink}>
              <span aria-hidden='true'>↗</span> 复制节目链接
            </button>

            <div className='sn-share-url-label'>节目链接</div>
            <div className='sn-share-url' title={shareUrl}>{shareUrl}</div>
            <p className='sn-share-status' aria-live='polite'>{status}</p>
            <p className='sn-share-tip'>封面会优先使用本期节目图片；如果图片服务器不允许跨域导出，海报会自动使用主题色占位。文字使用系统字体，不依赖外部字体文件。</p>
          </aside>
        </div>
      </section>

      <style jsx>{`
        .sn-share-overlay { position: fixed; inset: 0; z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 18px; background: rgba(24, 24, 28, 0.58); backdrop-filter: blur(3px); }
        .sn-share-dialog { width: min(100%, 980px); max-height: 92vh; overflow: auto; color: #34313a; background: #fff; border: 1px solid rgba(120, 113, 108, 0.2); border-radius: 16px; box-shadow: 0 22px 70px rgba(0, 0, 0, 0.22); }
        .sn-share-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 22px 24px 18px; border-bottom: 1px solid #eeeae5; }
        .sn-share-header h2 { margin: 0; font-size: 20px; line-height: 1.4; font-weight: 650; }
        .sn-share-header p { margin: 5px 0 0; color: #89838d; font-size: 13px; line-height: 1.6; }
        .sn-share-close { flex: 0 0 auto; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 50%; color: #77717d; background: #f4f2ef; font-size: 25px; line-height: 1; cursor: pointer; }
        .sn-share-content { display: grid; grid-template-columns: minmax(0, 1fr) 246px; gap: 22px; padding: 22px; }
        .sn-share-preview { min-width: 0; min-height: 320px; display: flex; align-items: center; justify-content: center; padding: 14px; border: 1px solid #ebe7e1; border-radius: 12px; background: #f4f2ee; }
        .sn-share-canvas { display: block; width: 100%; height: auto; max-height: 65vh; object-fit: contain; border-radius: 4px; box-shadow: 0 7px 24px rgba(35, 30, 40, 0.12); }
        .sn-share-canvas.is-portrait { max-width: 455px; }
        .sn-share-canvas.is-landscape { max-width: 100%; }
        .sn-share-controls { min-width: 0; display: flex; flex-direction: column; align-items: stretch; }
        .sn-share-brand { margin: 1px 0 22px; color: var(--theme-color, #928cee); font-size: 15px; font-weight: 650; }
        .sn-share-control-label { margin: 0 0 9px; color: #716b76; font-size: 13px; }
        .sn-share-orientation { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 4px; border-radius: 10px; background: #f3f1ee; }
        .sn-share-orientation button { min-height: 36px; border: 1px solid transparent; border-radius: 7px; color: #77717d; background: transparent; cursor: pointer; font-size: 13px; }
        .sn-share-orientation button.is-active { color: var(--theme-color, #928cee); background: #fff; border-color: var(--theme-color, #928cee); box-shadow: 0 1px 3px rgba(0,0,0,.05); }
        .sn-share-primary, .sn-share-secondary { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; margin-top: 14px; padding: 0 12px; border-radius: 9px; font-size: 14px; cursor: pointer; }
        .sn-share-primary { border: 1px solid var(--theme-color, #928cee); color: #fff; background: var(--theme-color, #928cee); }
        .sn-share-primary:disabled { opacity: .48; cursor: not-allowed; }
        .sn-share-secondary { margin-top: 8px; border: 1px solid #e3ded8; color: #514b56; background: #fff; }
        .sn-share-url-label { margin-top: 20px; margin-bottom: 6px; color: #77717d; font-size: 12px; }
        .sn-share-url { max-height: 72px; overflow: auto; overflow-wrap: anywhere; padding: 9px 10px; border-radius: 8px; color: #77717d; background: #f6f4f1; font-size: 11px; line-height: 1.5; user-select: text; }
        .sn-share-status { min-height: 20px; margin: 10px 0 0; color: var(--theme-color, #928cee); font-size: 12px; line-height: 1.5; }
        .sn-share-tip { margin: 8px 0 0; color: #9a949c; font-size: 11px; line-height: 1.65; }
        @media (max-width: 700px) {
          .sn-share-overlay { padding: 9px; }
          .sn-share-dialog { max-height: 94vh; border-radius: 13px; }
          .sn-share-header { padding: 16px 16px 13px; }
          .sn-share-header h2 { font-size: 18px; }
          .sn-share-content { display: flex; flex-direction: column; gap: 14px; padding: 12px; }
          .sn-share-preview { min-height: 0; padding: 8px; }
          .sn-share-canvas { max-height: 38vh; }
          .sn-share-canvas.is-portrait { max-width: min(100%, 270px); }
          .sn-share-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .sn-share-brand, .sn-share-control-label, .sn-share-orientation, .sn-share-url-label, .sn-share-url, .sn-share-status, .sn-share-tip { grid-column: 1 / -1; }
          .sn-share-brand { margin: 0 0 2px; }
          .sn-share-primary, .sn-share-secondary { margin-top: 0; min-height: 40px; font-size: 13px; }
          .sn-share-url-label { margin-top: 6px; }
          .sn-share-tip { margin-top: 0; }
        }
      `}</style>
    </div>
  )
}
