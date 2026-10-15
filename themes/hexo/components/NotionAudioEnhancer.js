import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import AudioPlayer from './AudioPlayer'

const enhanceAudio = () => {
  const containers = document.querySelectorAll('#notion-article .notion-audio')
  const players = []
  containers.forEach(container => {
    const nativeAudio = container.querySelector('audio')
    const src = nativeAudio?.getAttribute('src')
    if (!src) return
    const originalDisplay = nativeAudio.style.display
    nativeAudio.style.display = 'none'
    const mount = document.createElement('div')
    container.appendChild(mount)
    players.push({ mount, nativeAudio, originalDisplay, src })
  })
  return players
}

export default function NotionAudioEnhancer({ post }) {
  const [players, setPlayers] = useState([])

  const title = post?.title
  const cover = post?.pageCoverThumbnail || post?.pageCover
  const href = post?.href

  useEffect(() => {
    if (typeof window === 'undefined') return
    const timer = setTimeout(() => {
      const enhanced = enhanceAudio()
      setPlayers(enhanced)
    }, 500)

    return () => {
      clearTimeout(timer)
    }
  }, [post?.id])

  return (
    <>
      {players.map(({ mount, src }) =>
        createPortal(
          <AudioPlayer src={src} title={title} cover={cover} href={href} />,
          mount
        )
      )}
    </>
  )
}
