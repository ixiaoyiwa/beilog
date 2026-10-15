import { useCallback, useEffect, useState } from 'react'
import ButtonDarkModeFloat from './ButtonFloatDarkMode'
import ButtonJumpToTop from './ButtonJumpToTop'

const PlayIcon = ({ size = 14 }) => (
  <svg viewBox='0 0 24 24' width={size} height={size} fill='currentColor' style={{ marginLeft: '1px' }}>
    <path d='M8 5v14l11-7z' />
  </svg>
)
const PauseIcon = ({ size = 14 }) => (
  <svg viewBox='0 0 24 24' width={size} height={size} fill='currentColor'>
    <rect x='6' y='5' width='4' height='14' rx='1' />
    <rect x='14' y='5' width='4' height='14' rx='1' />
  </svg>
)

/**
 * iOS 风格菊花加载图标：8 个点围成一圈，依次亮起
 * 不依赖任何外部动画类，完全自写，保证会转
 */
const LoadingIcon = ({ size = 14 }) => {
  const dots = 8
  const radius = 9
  const dotR = 1.6
  return (
    <svg viewBox='0 0 24 24' width={size} height={size} fill='currentColor'>
      {Array.from({ length: dots }).map((_, i) => {
        const angle = (i * 45) * Math.PI / 180
        const cx = 12 + radius * Math.sin(angle)
        const cy = 12 - radius * Math.cos(angle)
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={dotR}
            style={{
              animation: 'ios-dot-fade 1s linear infinite',
              animationDelay: `${(i * 1) / dots}s`,
              opacity: 0.15
            }}
          />
        )
      })}
      <style jsx>{`
        @keyframes ios-dot-fade {
          0% { opacity: 0.15; }
          50% { opacity: 1; }
          100% { opacity: 0.15; }
        }
      `}</style>
    </svg>
  )
}

export default function RightFloatArea({ floatSlot }) {
  const [showFloatButton, switchShow] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasAudio, setHasAudio] = useState(false)
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(false)

  const scrollListener = useCallback(() => {
    const targetRef = document.getElementById('wrapper') || document.documentElement
    const clientHeight = targetRef?.clientHeight || 0
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
    const fullHeight = Math.max(1, clientHeight - viewportHeight)
    let per = parseFloat(((scrollY / fullHeight) * 100).toFixed(0))
    if (isNaN(per) || per < 0) per = 0
    if (per > 100) per = 100
    const shouldShow = scrollY > 100 && per > 0
    if (shouldShow !== showFloatButton) switchShow(shouldShow)
  }, [showFloatButton])

  useEffect(() => {
    const throttledScroll = () => window.requestAnimationFrame(() => scrollListener())
    window.addEventListener('scroll', throttledScroll, { passive: true })
    scrollListener()
    return () => window.removeEventListener('scroll', throttledScroll)
  }, [scrollListener])

  useEffect(() => {
    const onState = (e) => {
      setIsPlaying(e.detail.playing)
      setHasAudio(!!e.detail.hasAudio)
      setLocked(!!e.detail.locked)
      setLoading(!!e.detail.loading)
    }
    window.addEventListener('global-audio-state', onState)
    return () => window.removeEventListener('global-audio-state', onState)
  }, [])

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent('toggle-player-visibility'))
  }

  return (
    <div
      className={
        (showFloatButton ? 'opacity-100 ' : 'invisible opacity-0') +
        ' duration-300 transition-all bottom-12 right-1 fixed z-20 text-white bg-[#3A4A7A] dark:bg-hexo-black-gray rounded-sm'
      }>
      <div className='justify-center flex flex-col items-center cursor-pointer'>
        {hasAudio && !locked && (
          <div
            onClick={handleClick}
            className='flex justify-center items-center w-7 h-7 hover:bg-black/20 transition-colors'
            title='展开/收起播放器'>
            {loading ? (
              <LoadingIcon size={14} />
            ) : isPlaying ? (
              <PauseIcon size={14} />
            ) : (
              <PlayIcon size={14} />
            )}
          </div>
        )}
        <ButtonDarkModeFloat />
        {floatSlot}
        <ButtonJumpToTop />
      </div>
    </div>
  )
}
