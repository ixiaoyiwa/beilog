import { loadExternalResource } from '@/lib/utils'
import { useEffect, useRef } from 'react'

/**
 * 二维码生成
 * 每个实例使用独立的 DOM ref，避免侧边栏和文章分享区的二维码争用同一个 id。
 * size 为二维码实际生成尺寸，避免依赖 CSS 将大尺寸二维码压缩显示。
 */
export default function QrCode({ value, size = 256, level = 'H' }) {
  const containerRef = useRef(null)

  const qrCodeCDN =
    process.env.NEXT_PUBLIC_QR_CODE_CDN ||
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'

  useEffect(() => {
    const container = containerRef.current
    let qrcode = null
    let cancelled = false

    if (!value || !container || typeof window === 'undefined') {
      return undefined
    }

    // 清理当前实例容器，确保 value 更新时不会叠加旧二维码。
    container.innerHTML = ''

    loadExternalResource(qrCodeCDN, 'js')
      .then(() => {
        if (cancelled || !containerRef.current) return

        const QRCode = window.QRCode
        if (typeof QRCode === 'undefined') {
          console.error('二维码库加载成功，但 window.QRCode 不可用。')
          return
        }

        // 直接在当前组件自己的容器中生成，不再使用 document.getElementById。
        const correctLevel =
          QRCode.CorrectLevel[level] !== undefined
            ? QRCode.CorrectLevel[level]
            : QRCode.CorrectLevel.H

        qrcode = new QRCode(containerRef.current, {
          text: value,
          width: size,
          height: size,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel
        })
      })
      .catch(error => {
        if (!cancelled) {
          console.error('二维码库加载失败：', error)
        }
      })

    return () => {
      cancelled = true

      if (qrcode) {
        qrcode.clear()
      }

      if (container) {
        container.innerHTML = ''
      }
    }
  }, [value, size, level, qrCodeCDN])

  return (
    <div
      ref={containerRef}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        lineHeight: 0,
        flex: '0 0 auto'
      }}
    />
  )
}
