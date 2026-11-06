import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import AudioPlayer from './AudioPlayer'

/**
 * 把正文里的原生 <audio>(.notion-audio)换成站点自己的播放器。
 * 适用:宽页面(FAQ、普通文章)里 Notion 正文或 Markdown 正文中的音频。
 * 节目页(有 Audio 字段)在 LayoutSlug 里不会挂载本组件,页头播放器保持原样。
 *
 * 与旧版的区别:
 *  1. 不再只在挂载后 500ms 扫一次:立即扫一次 + 兜底定时扫 + MutationObserver 监听后续新增的音频;
 *  2. 幂等:同一个音频容器只会被接管一次,不会重复插入播放器;
 *  3. 卸载或切换文章时,还原被隐藏的原生播放器、移除挂载点。
 */
const SELECTOR = '#notion-article .notion-audio'

function adopt(container) {
  if (container.getAttribute('data-audio-enhanced') === '1') return null
  const nativeAudio = container.querySelector('audio')
  const src = nativeAudio?.getAttribute('src')
  if (!src) return null
  const originalDisplay = nativeAudio.style.display
  nativeAudio.style.display = 'none'
  const mount = document.createElement('div')
  mount.setAttribute('data-audio-mount', '1')
  container.appendChild(mount)
  container.setAttribute('data-audio-enhanced', '1')
  return { container, mount, nativeAudio, originalDisplay, src }
}

export default function NotionAudioEnhancer({ post }) {
  const [players, setPlayers] = useState([])

  const title = post?.title
  const cover = post?.pageCoverThumbnail || post?.pageCover
  const href = post?.href

  useEffect(() => {
    if (typeof window === 'undefined') return
    let disposed = false
    const known = new Map() // 容器 -> 接管信息

    const scan = () => {
      if (disposed) return
      let changed = false
      document.querySelectorAll(SELECTOR).forEach(container => {
        if (known.has(container)) return
        const entry = adopt(container)
        if (entry) {
          known.set(container, entry)
          changed = true
        }
      })
      // 容器已经不在页面里了(被重新渲染掉):移出列表
      for (const [container] of known) {
        if (!container.isConnected) {
          known.delete(container)
          changed = true
        }
      }
      if (changed) setPlayers([...known.values()])
    }

    scan()
    const timers = [setTimeout(scan, 300), setTimeout(scan, 1200), setTimeout(scan, 3000)]

    let observer
    let pending = null
    const root = document.getElementById('article-wrapper') || document.body
    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(() => {
        if (pending) return
        pending = setTimeout(() => {
          pending = null
          scan()
        }, 100)
      })
      observer.observe(root, { childList: true, subtree: true })
    }

    return () => {
      disposed = true
      timers.forEach(clearTimeout)
      if (pending) clearTimeout(pending)
      if (observer) observer.disconnect()
      for (const [container, e] of known) {
        e.mount.remove()
        e.nativeAudio.style.display = e.originalDisplay
        container.removeAttribute('data-audio-enhanced')
      }
      known.clear()
      setPlayers([])
    }
  }, [post?.id])

  return (
    <>
      {players.map(({ mount, src }, i) =>
        createPortal(
          <AudioPlayer src={src} title={title} cover={cover} href={href} />,
          mount,
          `${src}#${i}`
        )
      )}
    </>
  )
}
