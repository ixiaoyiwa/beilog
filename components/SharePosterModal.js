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

function getThemeColor() {
  if (typeof window === 'undefined') return '#928CEE'
  const themeRoot = document.querySelector('#theme-hexo') || document.documentElement
  const value = window.getComputedStyle(themeRoot).getPropertyValue('--theme-color').trim()
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : '#928CEE'
}

function getEpisodeNumber(post) {
  const slug = String(post?.slug || '')
  const match = slug.match(/(\d+)(?!.*\d)/)
  return match ? `E${match[1]}` : ''
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
  fillRoundedRect(ctx, x, y, width, height, radius, '#2A2A2E')
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${Math.max(26, Math.min(42, width * 0.055))}px ${POSTER_FONT}`
  ctx.fillText('念安酒馆', x + width / 2, y + height / 2)
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

async function drawPoster({ canvas, post, shareUrl, orientation, duration }) {
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
  const coverSource = post?.pageCoverThumbnail || post?.pageCover || ''
  const episodeNumber = getEpisodeNumber(post)
  const category = String(post?.category || '')
  const date = String(post?.publishDay || post?.date || '')
  const meta = [episodeNumber, category, date].filter(Boolean).join('　·　')

  // 1. 绘制小宇宙风格的高级渐变背景 (深灰蓝过渡)
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#1E2025')
  gradient.addColorStop(1, '#2B2D35')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

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
    // === 竖版布局 (1080 x 1440) ===
    const coverW = 880
    const coverH = 880
    const coverX = (width - coverW) / 2
    const coverY = 100
    const coverRadius = 24

    if (coverImage) {
      drawCroppedImage(ctx, coverImage, coverX, coverY, coverW, coverH, coverRadius)
    } else {
      drawCoverPlaceholder(ctx, coverX, coverY, coverW, coverH, coverRadius, accent)
    }

    // 左下角时长胶囊
    if (duration) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
      fillRoundedRect(ctx, coverX + 24, coverY + coverH - 56, 100, 36, 18, 'rgba(0,0,0,0.6)')
      ctx.fillStyle = '#FFFFFF'
      ctx.font = `500 18px ${POSTER_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(duration, coverX + 74, coverY + coverH - 38)
    }

    // 信息区域
    let currentY = coverY + coverH + 50

    // 标题
    ctx.textAlign = 'left'
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `600 44px ${POSTER_FONT}`
    const titleResult = wrapAndDrawText(ctx, title, 100, currentY, 880, 58, 2)
    currentY = titleResult.nextY + 24

    // Meta 信息 (如 E983 · 碎碎念 · 2026-10-19)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.font = `400 24px ${POSTER_FONT}`
    ctx.fillText(meta, 100, currentY)

    // 底部信息栏 (二维码 + 文字)
    const bottomY = height - 160
    if (qrCanvas) {
      // 白底圆角框住二维码
      fillRoundedRect(ctx, 100, bottomY, 110, 110, 12, '#FFFFFF')
      ctx.drawImage(qrCanvas, 104, bottomY + 4, 102, 102)
    }

    ctx.textAlign = 'left'
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `500 28px ${POSTER_FONT}`
    ctx.fillText('扫码收听本期', 240, bottomY + 45)

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.font = `400 20px ${POSTER_FONT}`
    ctx.fillText(brand, 240, bottomY + 80)

  } else {
    // === 横版布局 (1440 x 1080) ===
    const coverSize = 600
    const coverX = 100
    const coverY = (height - coverSize) / 2
    const coverRadius = 24

    if (coverImage) {
      drawCroppedImage(ctx, coverImage, coverX, coverY, coverSize, coverSize, coverRadius)
    } else {
      drawCoverPlaceholder(ctx, coverX, coverY, coverSize, coverSize, coverRadius, accent)
    }

    // 左下角时长胶囊
    if (duration) {
      fillRoundedRect(ctx, coverX + 24, coverY + coverSize - 56, 100, 36, 18, 'rgba(0,0,0,0.6)')
      ctx.fillStyle = '#FFFFFF'
      ctx.font = `500 18px ${POSTER_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(duration, coverX + 74, coverY + coverSize - 38)
    }

    // 右侧文字信息
    const textX = coverX + coverSize + 80
    let currentY = coverY + 80

    ctx.textAlign = 'left'
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `600 56px ${POSTER_FONT}`
    const titleResult = wrapAndDrawText(ctx, title, textX, currentY, 520, 72, 3)
    currentY = titleResult.nextY + 30

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.font = `400 26px ${POSTER_FONT}`
    ctx.fillText(meta, textX, currentY)

    // 底部信息栏
    const bottomY = height - 220
    if (qrCanvas) {
      fillRoundedRect(ctx, textX, bottomY, 120, 120, 12, '#FFFFFF')
      ctx.drawImage(qrCanvas, 104 + textX - 100, bottomY + 4, 112, 112)
    }

    ctx.fillStyle = '#FFFFFF'
    ctx.font = `500 30px ${POSTER_FONT}`
    ctx.fillText('扫码收听本期', textX + 150, bottomY + 50)

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.font = `400 22px ${POSTER_FONT}`
    ctx.fillText(brand, textX + 150, bottomY + 90)
  }

  return { qrReady: !!qrCanvas, coverLoaded, hasCover: !!coverSource }
}

function safeFileName(value) {
  // 将横竖版等字眼去掉，仅保留 标题-念安酒馆
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
  const [status, setStatus] = useState('')
  const [duration, setDuration] = useState('')

  // 提取音频时长 (如果在页面DOM里能找到)
  useEffect(() => {
    if (!open) return
    const audioEl = document.querySelector('audio')
    if (audioEl && audioEl.duration) {
      const m = Math.floor(audioEl.duration / 60)
      const s = Math.floor(audioEl.duration % 60)
      setDuration(`${m}:${s.toString().padStart(2, '0')}`)
    } else {
      setDuration('')
    }
  }, [open])

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
    drawPoster({ canvas, post, shareUrl, orientation, duration }).then(result => {
      if (cancelled) return
      setReady(result.qrReady)
      if (!result.qrReady) setStatus('二维码资源加载失败。请检查二维码 CDN；复制链接仍可使用。')
      else if (result.hasCover && !result.coverLoaded) setStatus('封面图受跨域限制，已用主题色占位；海报仍可下载。')
      else setStatus('')
    }).catch(() => {
      if (cancelled) return
      setReady(false)
      setStatus('海报生成失败，请刷新页面后重试；你仍然可以复制节目链接。')
    })

    return () => { cancelled = true }
  }, [open, orientation, shareUrl, duration, post?.title, post?.summary, post?.pageCover, post?.pageCoverThumbnail, post?.slug, post?.category, post?.date, post?.publishDay])

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
      // 命名去掉横竖版
      anchor.download = `${safeFileName(post?.title)}.png`
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
            {/* 右下角悬浮切换按钮 */}
            <div className='sn-share-toggle-float'>
              <button type='button' className={orientation === 'portrait' ? 'is-active' : ''} onClick={() => setOrientation('portrait')}>竖版</button>
              <button type='button' className={orientation === 'landscape' ? 'is-active' : ''} onClick={() => setOrientation('landscape')}>横版</button>
            </div>
          </div>

          <aside className='sn-share-controls'>
            <div className='sn-share-brand'>{title}</div>

            <button className='sn-share-primary' type='button' onClick={downloadPoster} disabled={!ready}>
              <span aria-hidden='true'>↓</span> 下载海报 PNG
            </button>
            <button className='sn-share-secondary' type='button' onClick={copyLink}>
              <span aria-hidden='true'>↗</span> 复制节目链接
            </button>

            <div className='sn-share-url-label'>节目链接</div>
            <div className='sn-share-url' title={shareUrl}>{shareUrl}</div>
            <p className='sn-share-status' aria-live='polite'>{status}</p>
            <p className='sn-share-tip'>如果图片服务器不允许跨域导出，海报会自动使用主题色占位。文字使用系统字体。</p>
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
        
        /* 预览区 & 悬浮切换 */
        .sn-share-preview { position: relative; min-width: 0; min-height: 320px; display: flex; align-items: center; justify-content: center; padding: 14px; border: 1px solid #ebe7e1; border-radius: 12px; background: #e9e6e1; overflow: hidden; }
        .sn-share-canvas { display: block; width: 100%; height: auto; max-height: 65vh; object-fit: contain; border-radius: 12px; box-shadow: 0 7px 24px rgba(35, 30, 40, 0.15); transition: max-width 0.3s ease; }
        .sn-share-canvas.is-portrait { max-width: 360px; }
        .sn-share-canvas.is-landscape { max-width: 100%; }
        
        .sn-share-toggle-float { position: absolute; bottom: 24px; right: 24px; display: flex; gap: 4px; padding: 4px; border-radius: 10px; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); }
        .sn-share-toggle-float button { min-height: 28px; padding: 0 12px; border: 0; border-radius: 6px; color: rgba(255,255,255,0.7); background: transparent; cursor: pointer; font-size: 12px; transition: all 0.2s; }
        .sn-share-toggle-float button.is-active { color: #000; background: #fff; font-weight: 600; }

        .sn-share-controls { min-width: 0; display: flex; flex-direction: column; align-items: stretch; }
        .sn-share-brand { margin: 1px 0 22px; color: var(--theme-color, #928cee); font-size: 15px; font-weight: 650; }
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
          .sn-share-canvas { max-height: 45vh; }
          .sn-share-canvas.is-portrait { max-width: min(100%, 270px); }
          .sn-share-toggle-float { bottom: 14px; right: 14px; }
          .sn-share-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .sn-share-brand, .sn-share-url-label, .sn-share-url, .sn-share-status, .sn-share-tip { grid-column: 1 / -1; }
          .sn-share-brand { margin: 0 0 2px; }
          .sn-share-primary, .sn-share-secondary { margin-top: 0; min-height: 40px; font-size: 13px; }
          .sn-share-url-label { margin-top: 6px; }
          .sn-share-tip { margin-top: 0; }
        }
      `}</style>
    </div>
  )
}
