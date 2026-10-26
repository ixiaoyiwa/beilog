import { useEffect, useRef, useState } from 'react'
import { loadExternalResource } from '@/lib/utils'
import { siteConfig } from '@/lib/config'

const QR_CODE_CDN =
  process.env.NEXT_PUBLIC_QR_CODE_CDN ||
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'

const POSTER_FONT =
  '"LXGW WenKai", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif'

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

function getEpisodeNumber(post) {
  const slug = String(post?.slug || '')
  const match = slug.match(/(\d+)(?!.*\d)/)
  return match ? `E${match[1]}` : ''
}

function wrapAndDrawText(ctx, rawText, x, y, maxWidth, lineHeight, maxLines, center = false) {
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
  if (center) ctx.textAlign = 'center'
  
  lines.forEach((textLine, index) => {
    ctx.fillText(textLine, x, y + index * lineHeight)
  })

  return {
    nextY: y + lines.length * lineHeight,
    lineCount: lines.length
  }
}

// 核心：使用 wsrv.nl 免费图片代理，绕开喜马拉雅的跨域防盗链
function loadCoverImage(source) {
  if (!source || typeof window === 'undefined') return Promise.resolve(null)

  return new Promise(resolve => {
    const image = new window.Image()
    let settled = false
    let usedProxy = false

    const finish = value => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      resolve(value)
    }
    
    const timeoutId = window.setTimeout(() => finish(null), 8000)
    
    // 尝试直接加载
    const loadDirect = () => {
      try {
        const parsed = new URL(source, window.location.href)
        if (/^https?:$/.test(parsed.protocol) && parsed.origin !== window.location.origin) {
          image.crossOrigin = 'anonymous'
        }
      } catch {}
      image.src = source
    }

    // 如果直接加载失败，用代理再试一次
    image.onerror = () => {
      if (!usedProxy) {
        usedProxy = true
        image.crossOrigin = 'anonymous'
        image.src = `https://wsrv.nl/?url=${encodeURIComponent(source)}`
      } else {
        finish(null)
      }
    }
    
    image.onload = () => {
      if (image.naturalWidth > 0) finish(image)
    }

    loadDirect()
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

// 绝美渐变色占位图，如果代理也失败的话
function drawBeautifulPlaceholder(ctx, x, y, width, height, radius) {
  ctx.save()
  roundedRectPath(ctx, x, y, width, height, radius)
  ctx.clip()
  
  const grad = ctx.createLinearGradient(x, y, x, y + height)
  grad.addColorStop(0, '#3A3A40')
  grad.addColorStop(1, '#1A1A1C')
  ctx.fillStyle = grad
  ctx.fillRect(x, y, width, height)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${Math.max(24, Math.min(42, width * 0.08))}px ${POSTER_FONT}`
  ctx.fillText('念安酒馆', x + width / 2, y + height / 2)
  ctx.restore()
}

async function createQrCanvas(value) {
  await loadExternalResource(QR_CODE_CDN, 'js')
  const QRCodeConstructor = typeof window !== 'undefined' ? window.QRCode : null
  if (typeof QRCodeConstructor !== 'function') throw new Error('二维码加载失败')

  const host = document.createElement('div')
  new QRCodeConstructor(host, {
    text: value,
    width: 256,
    height: 256,
    colorDark: '#000000',
    colorLight: '#FFFFFF',
    correctLevel: QRCodeConstructor.CorrectLevel?.H ?? 2
  })

  let sourceCanvas = host.querySelector('canvas')
  if (!sourceCanvas) {
    const image = host.querySelector('img')
    if (image && image.complete && image.naturalWidth > 0) {
      sourceCanvas = document.createElement('canvas')
      sourceCanvas.width = 256
      sourceCanvas.height = 256
      sourceCanvas.getContext('2d').drawImage(image, 0, 0, 256, 256)
    }
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
  if (!ctx) throw new Error('Canvas 初始化失败')

  const brand = '念安酒馆'
  const title = String(post?.title || '这一期，等你来听')
  const coverSource = post?.pageCoverThumbnail || post?.pageCover || ''
  const episodeNumber = getEpisodeNumber(post)
  const category = String(post?.category || '')
  const date = String(post?.publishDay || post?.date || '')
  const meta = [episodeNumber, category, date].filter(Boolean).join('  ·  ')

  // 1. 整个图片从上到下的垂直渐变背景
  const bgGradient = ctx.createLinearGradient(0, 0, 0, height)
  bgGradient.addColorStop(0, '#1E1E22') 
  bgGradient.addColorStop(1, '#121214')
  ctx.fillStyle = bgGradient
  ctx.fillRect(0, 0, width, height)

  const coverImage = await loadCoverImage(coverSource)
  let qrCanvas = null
  try { qrCanvas = await createQrCanvas(shareUrl) } catch {}

  const drawDurationCapsule = (x, y) => {
    if (!duration) return
    fillRoundedRect(ctx, x, y, 100, 36, 18, 'rgba(0,0,0,0.65)')
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.moveTo(x + 16, y + 10)
    ctx.lineTo(x + 16, y + 26)
    ctx.lineTo(x + 28, y + 18)
    ctx.closePath()
    ctx.fill()

    ctx.font = `500 16px ${POSTER_FONT}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(duration, x + 36, y + 19)
  }

  if (!landscape) {
    const coverSize = 800
    const coverX = (width - coverSize) / 2
    const coverY = 120
    
    if (coverImage) drawCroppedImage(ctx, coverImage, coverX, coverY, coverSize, coverSize, 24)
    else drawBeautifulPlaceholder(ctx, coverX, coverY, coverSize, coverSize, 24)
    
    drawDurationCapsule(coverX + 20, coverY + coverSize - 56)

    let currentY = coverY + coverSize + 60
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `600 48px ${POSTER_FONT}`
    const titleResult = wrapAndDrawText(ctx, title, width / 2, currentY, 880, 64, 2, true)
    currentY = titleResult.nextY + 24

    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = `400 24px ${POSTER_FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(meta, width / 2, currentY)

    const bottomY = height - 180
    const qrSize = 110
    const qrX = width / 2 - 130 
    
    if (qrCanvas) {
      fillRoundedRect(ctx, qrX, bottomY, qrSize, qrSize, 12, '#FFFFFF')
      ctx.drawImage(qrCanvas, qrX + 8, bottomY + 8, qrSize - 16, qrSize - 16)
    }
    
    ctx.textAlign = 'left'
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `500 26px ${POSTER_FONT}`
    ctx.fillText('扫码收听本期', qrX + qrSize + 24, bottomY + 40)
    
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = `400 20px ${POSTER_FONT}`
    ctx.fillText(brand, qrX + qrSize + 24, bottomY + 78)

  } else {
    const coverSize = 760
    const coverX = 100
    const coverY = (height - coverSize) / 2

    if (coverImage) drawCroppedImage(ctx, coverImage, coverX, coverY, coverSize, coverSize, 24)
    else drawBeautifulPlaceholder(ctx, coverX, coverY, coverSize, coverSize, 24)
    
    drawDurationCapsule(coverX + 20, coverY + coverSize - 56)

    const textX = coverX + coverSize + 80
    const textWidth = width - textX - 100
    let currentY = coverY + 140

    ctx.textAlign = 'left'
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `600 50px ${POSTER_FONT}`
    const titleResult = wrapAndDrawText(ctx, title, textX, currentY, textWidth, 68, 3, false)
    currentY = titleResult.nextY + 30

    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = `400 26px ${POSTER_FONT}`
    ctx.fillText(meta, textX, currentY)

    const bottomY = height - 260
    const qrSize = 120
    if (qrCanvas) {
      fillRoundedRect(ctx, textX, bottomY, qrSize, qrSize, 12, '#FFFFFF')
      ctx.drawImage(qrCanvas, textX + 8, bottomY + 8, qrSize - 16, qrSize - 16)
    }
    
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `500 28px ${POSTER_FONT}`
    ctx.fillText('扫码收听本期', textX + qrSize + 24, bottomY + 45)
    
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = `400 20px ${POSTER_FONT}`
    ctx.fillText(brand, textX + qrSize + 24, bottomY + 85)
  }

  return { qrReady: !!qrCanvas }
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
    drawPoster({ canvas, post, shareUrl, orientation, duration }).then(result => {
      if (cancelled) return
      setReady(result.qrReady)
    }).catch(() => {
      if (cancelled) return
      setReady(false)
    })

    return () => { cancelled = true }
  }, [open, orientation, shareUrl, duration, post])

  if (!open) return null

  const copyLink = async () => {
    const value = shareUrl || window.location.href
    if (!value) return
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value)
      else throw new Error()
    } catch {
      const input = document.createElement('textarea')
      input.value = value
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      input.remove()
    }
  }

  const downloadPoster = async () => {
    const canvas = canvasRef.current
    if (!canvas || !ready) return
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      const downloadUrl = blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png')
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = `${safeFileName(post?.title)}.png`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      if (blob) window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
    } catch {}
  }

  return (
    <div className='sn-share-overlay' onMouseDown={e => e.target === e.currentTarget && onClose?.()}>
      <section className='sn-share-dialog'>
        <header className='sn-share-header'>
          <h2>分享这一期</h2>
          <button className='sn-share-close' onClick={onClose}>×</button>
        </header>

        <div className='sn-share-body'>
          <div className='sn-share-preview'>
            <canvas ref={canvasRef} className={`sn-share-canvas ${orientation}`} />
            
            <div className='sn-share-toggle-float'>
              <button className={orientation === 'portrait' ? 'is-active' : ''} onClick={() => setOrientation('portrait')}>竖版</button>
              <button className={orientation === 'landscape' ? 'is-active' : ''} onClick={() => setOrientation('landscape')}>横版</button>
            </div>
          </div>

          {/* 底部极简操作栏，完全模仿小宇宙 */}
          <div className='sn-share-actions'>
            <button className='sn-action-btn' onClick={downloadPoster} disabled={!ready}>
              <div className='sn-action-icon'>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              </div>
              <span>保存图片</span>
            </button>
            <button className='sn-action-btn' onClick={copyLink}>
              <div className='sn-action-icon'>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              </div>
              <span>复制链接</span>
            </button>
          </div>
        </div>
      </section>

      <style jsx>{`
        .sn-share-overlay { position: fixed; inset: 0; z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 18px; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px); }
        .sn-share-dialog { width: min(100%, 680px); max-height: 94vh; background: #fff; border-radius: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden; }
        
        .sn-share-header { padding: 16px 20px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
        .sn-share-header h2 { margin: 0; font-size: 16px; font-weight: 600; color: #333; }
        .sn-share-close { width: 32px; height: 32px; border: 0; background: transparent; font-size: 24px; color: #999; cursor: pointer; }

        .sn-share-body { padding: 20px; display: flex; flex-direction: column; align-items: center; overflow-y: auto; }
        
        .sn-share-preview { position: relative; display: flex; justify-content: center; width: 100%; margin-bottom: 24px; }
        .sn-share-canvas { display: block; width: 100%; height: auto; max-height: 60vh; object-fit: contain; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); transition: max-width 0.3s ease; }
        .sn-share-canvas.portrait { max-width: 320px; }
        .sn-share-canvas.landscape { max-width: 100%; }
        
        /* 悬浮切换按钮 */
        .sn-share-toggle-float { position: absolute; bottom: 12px; right: calc(50% - 160px + 12px); display: flex; gap: 2px; padding: 3px; border-radius: 8px; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); z-index: 10; }
        .sn-share-canvas.landscape + .sn-share-toggle-float { right: 12px; }
        .sn-share-toggle-float button { min-height: 24px; padding: 0 10px; border: 0; border-radius: 6px; color: rgba(255,255,255,0.7); background: transparent; cursor: pointer; font-size: 12px; }
        .sn-share-toggle-float button.is-active { color: #000; background: #fff; font-weight: 600; }

        /* 底部操作栏 */
        .sn-share-actions { display: flex; gap: 40px; justify-content: center; align-items: center; margin-top: auto; }
        .sn-action-btn { display: flex; flex-direction: column; align-items: center; gap: 8px; border: 0; background: transparent; cursor: pointer; color: #333; transition: opacity 0.2s; }
        .sn-action-btn:hover { opacity: 0.7; }
        .sn-action-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .sn-action-icon { width: 48px; height: 48px; border-radius: 50%; background: #f5f5f7; display: flex; align-items: center; justify-content: center; }
        .sn-action-icon svg { width: 20px; height: 20px; color: #1a1a1c; }
        .sn-action-btn span { font-size: 13px; font-weight: 500; }

        @media (max-width: 600px) {
          .sn-share-dialog { max-height: 98vh; width: 100%; border-radius: 12px; }
          .sn-share-body { padding: 12px; }
          .sn-share-canvas { max-height: 55vh; }
          .sn-share-canvas.portrait { max-width: 260px; }
          .sn-share-toggle-float { bottom: 8px; right: calc(50% - 130px + 8px); }
          .sn-share-canvas.landscape + .sn-share-toggle-float { right: 8px; }
          .sn-share-actions { gap: 30px; }
          .sn-action-icon { width: 44px; height: 44px; }
        }
      `}</style>
    </div>
  )
}
