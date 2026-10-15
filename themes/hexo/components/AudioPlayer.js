import { useEffect, useRef, useState } from 'react'

const PlayIcon = ({ size = 12 }) => (
  <svg viewBox='0 0 24 24' width={size} height={size} fill='currentColor' style={{ marginLeft: '1px' }}>
    <path d='M8 5v14l11-7z' />
  </svg>
)
const PauseIcon = ({ size = 12 }) => (
  <svg viewBox='0 0 24 24' width={size} height={size} fill='currentColor'>
    <rect x='6' y='5' width='4' height='14' rx='1' />
    <rect x='14' y='5' width='4' height='14' rx='1' />
  </svg>
)

const formatRemaining = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '-0:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `-${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `-${m}:${s.toString().padStart(2, '0')}`
}

export default function AudioPlayer({ src, title, cover, href }) {
  const [progress, setProgress] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [localDuration, setLocalDuration] = useState(0)
  const [isCurrentSrc, setIsCurrentSrc] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const localAudioRef = useRef(null)

  useEffect(() => {
    const onState = (e) => {
      const { src: currentSrc, playing, currentTime, duration } = e.detail
      if (currentSrc === src) {
        setIsCurrentSrc(true)
        setIsPlaying(playing)
        const dur = duration || localDuration
        if (dur > 0) {
          setProgress((currentTime / dur) * 100)
          setRemaining(Math.max(0, dur - currentTime))
        }
      } else {
        setIsCurrentSrc(false)
        setIsPlaying(false)
      }
    }
    window.addEventListener('global-audio-state', onState)
    return () => window.removeEventListener('global-audio-state', onState)
  }, [src, localDuration])

  const handleMetadata = (e) => {
    const dur = e.target.duration || 0
    setLocalDuration(dur)
    if (!isCurrentSrc) setRemaining(dur)
  }

  const handleWaiting = () => setIsLoading(true)
  const handleCanPlay = () => setIsLoading(false)

  const handleClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    window.dispatchEvent(
      new CustomEvent('toggle-global-audio', {
        detail: { src, title, cover, href }
      })
    )
  }

  const active = isCurrentSrc && isPlaying
  // 未播放/暂停：纯主题色；播放中：主题色渐变
  const buttonStyle = {
    background: active
      ? 'linear-gradient(135deg, #7B8BC4 0%, #3A4A7A 100%)'
      : '#3A4A7A'
  }
  const playedBarStyle = {
    width: `${progress}%`,
    background: progress > 0
      ? 'linear-gradient(90deg, #8B9BD4 0%, #4A5A8A 50%, #3A4A7A 100%)'
      : 'transparent'
  }

  return (
    <div className='my-4 flex items-center gap-3 rounded-xl px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5'>
      <audio
        ref={localAudioRef}
        src={src}
        preload='metadata'
        onLoadedMetadata={handleMetadata}
        onWaiting={handleWaiting}
        onCanPlay={handleCanPlay}
        style={{ display: 'none' }}
      />

      <button
        onClick={handleClick}
        className='flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105 text-white'
        style={buttonStyle}>
        {active ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
      </button>

      <div
        className={`flex-1 h-1 rounded-full overflow-hidden relative bg-gray-200/60 dark:bg-gray-700/60 backdrop-blur-sm ${
          isLoading ? 'loading-stripe' : ''
        }`}>
        <div
          className='h-full rounded-full transition-all duration-300'
          style={playedBarStyle}
        />
      </div>

      <span className='flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap'>
        {formatRemaining(remaining)}
      </span>

      <style jsx>{`
        @keyframes stripe-move {
          0% { background-position: 0 0; }
          100% { background-position: 32px 0; }
        }
        .loading-stripe {
          background: repeating-linear-gradient(
            -45deg,
            rgba(58, 74, 122, 0.25) 0px,
            rgba(58, 74, 122, 0.25) 8px,
            rgba(58, 74, 122, 0.05) 8px,
            rgba(58, 74, 122, 0.05) 16px
          );
          background-size: 32px 100%;
          animation: stripe-move 0.8s linear infinite;
        }
      `}</style>
    </div>
  )
}
