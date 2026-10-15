import { useEffect, useRef, useState } from 'react'
import SmartLink from '@/components/SmartLink'
import { siteConfig } from '@/lib/config'

const formatTime = (s) => {
  if (!Number.isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const SPEEDS = [1, 1.25, 1.5, 2, 0.75]
const TITLE_MAX_LENGTH = 18
const LOADING_MIN_MS = 500

const PlayIcon = ({ size = 18 }) => (
  <svg viewBox='0 0 24 24' width={size} height={size} fill='currentColor' style={{ marginLeft: '2px' }}>
    <path d='M8 5v14l11-7z' />
  </svg>
)
const PauseIcon = ({ size = 18 }) => (
  <svg viewBox='0 0 24 24' width={size} height={size} fill='currentColor'>
    <rect x='6' y='5' width='4' height='14' rx='1' />
    <rect x='14' y='5' width='4' height='14' rx='1' />
  </svg>
)

/**
 * iOS 风格菊花加载图标：8 个点围成一圈，依次亮起
 * 不依赖任何外部动画类，完全自写，保证会转
 */
const LoadingIcon = ({ size = 18 }) => {
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

export default function GlobalAudioPlayer() {
  const audioRef = useRef(null)
  const progressRef = useRef(null)
  const titleRef = useRef(null)
  const scrollAccumulator = useRef(0)
  const lastScrollY = useRef(0)
  const loadingStartRef = useRef(0)
  const loadingTimerRef = useRef(null)

  const [audioData, setAudioData] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const [speedIndex, setSpeedIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [minimized, setMinimized] = useState(true)
  const [noAudioMessage, setNoAudioMessage] = useState('')
  const [titleOverflow, setTitleOverflow] = useState(false)
  const [locked, setLocked] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [loading, setLoading] = useState(false)

  const bannerDefault = siteConfig('HOME_BANNER_IMAGE') || ''
  const coverSrc = audioData?.cover || bannerDefault

  const startLoading = () => {
    loadingStartRef.current = Date.now()
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current)
      loadingTimerRef.current = null
    }
    setLoading(true)
  }

  const stopLoading = () => {
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current)
      loadingTimerRef.current = null
    }
    const elapsed = Date.now() - loadingStartRef.current
    if (elapsed < LOADING_MIN_MS) {
      loadingTimerRef.current = setTimeout(() => {
        setLoading(false)
        loadingTimerRef.current = null
      }, LOADING_MIN_MS - elapsed)
    } else {
      setLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current)
        loadingTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (audioData?.title) {
      setTitleOverflow(audioData.title.length > TITLE_MAX_LENGTH)
    } else {
      setTitleOverflow(false)
    }
  }, [audioData?.title, visible])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    audio.muted = muted

    const onTime = () => setCurrentTime(audio.currentTime)
    const onMeta = () => setDuration(audio.duration || 0)
    const onPlay = () => {
      setPlaying(true)
    }
    const onPlaying = () => {
      setPlaying(true)
      stopLoading()
    }
    const onPause = () => {
      setPlaying(false)
      setLoading(false)
    }
    const onEnd = () => {
      setPlaying(false)
      setLoading(false)
      setCurrentTime(audio.duration || 0)
    }
    const onWaiting = () => {
      if (playing) startLoading()
    }
    const onError = () => {
      setPlaying(false)
      setLoading(false)
    }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('playing', onPlay)
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('playing', onPlay)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('error', onError)
    }
  }, [volume, muted, playing])

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('global-audio-state', {
        detail: {
          src: audioData?.src || null,
          playing,
          currentTime,
          duration,
          hasAudio: !!audioData?.src,
          locked,
          loading
        }
      })
    )
  }, [playing, audioData?.src, currentTime, duration, locked, loading])

  useEffect(() => {
    const onToggle = (e) => {
      const { src, cover, title, href } = e.detail || {}
      if (!src) return
      const audio = audioRef.current
      if (!audio) return

      const isSame = audioData?.src === src
      if (isSame) {
        if (audio.paused) {
          startLoading()
          audio.play().catch(() => {})
        } else {
          audio.pause()
        }
      } else {
        startLoading()
        audio.src = src
        audio.currentTime = 0
        audio.play().catch(() => {})
        setAudioData({ src, cover, title, href })
        setCurrentTime(0)
        setDuration(0)
      }
      setNoAudioMessage('')
      setVisible(true)
      setMinimized(false)
    }

    const onToggleVisibility = () => {
      setVisible(true)
      setMinimized((m) => !m)
    }

    const onShowNoAudio = (e) => {
      const msg = e.detail?.message || '当前暂无音频节目，请前往节目页面播放'
      setNoAudioMessage(msg)
      setAudioData(null)
      setVisible(true)
      setMinimized(false)
    }

    const onSeek = (e) => {
      const { seconds, src, cover, title, href } = e.detail || {}
      if (!src) return
      if (!Number.isFinite(seconds) || seconds < 0) return
      const audio = audioRef.current
      if (!audio) return

      const isSame = audioData?.src === src

      if (isSame) {
        const doSeek = () => {
          audio.currentTime = seconds
          setCurrentTime(seconds)
          if (audio.paused) audio.play().catch(() => {})
        }
        if (audio.readyState >= 1) doSeek()
        else {
          const once = () => {
            audio.removeEventListener('loadedmetadata', once)
            doSeek()
          }
          audio.addEventListener('loadedmetadata', once)
        }
      } else {
        audio.pause()
        audio.src = src
        audio.load()
        setAudioData({ src, cover, title, href })
        setCurrentTime(0)
        setDuration(0)

        const once = () => {
          audio.removeEventListener('loadedmetadata', once)
          audio.currentTime = seconds
          setCurrentTime(seconds)
          audio.play().catch(() => {})
        }
        audio.addEventListener('loadedmetadata', once)
      }

      setNoAudioMessage('')
      setVisible(true)
      setMinimized(false)
    }

    window.addEventListener('toggle-global-audio', onToggle)
    window.addEventListener('toggle-player-visibility', onToggleVisibility)
    window.addEventListener('show-no-audio-hint', onShowNoAudio)
    window.addEventListener('seek-global-audio', onSeek)
    return () => {
      window.removeEventListener('toggle-global-audio', onToggle)
      window.removeEventListener('toggle-player-visibility', onToggleVisibility)
      window.removeEventListener('show-no-audio-hint', onShowNoAudio)
      window.removeEventListener('seek-global-audio', onSeek)
    }
  }, [audioData])

  useEffect(() => {
    if (!visible || minimized || locked) return
    lastScrollY.current = window.pageYOffset
    scrollAccumulator.current = 0

    const onScroll = () => {
      const y = window.pageYOffset
      scrollAccumulator.current += Math.abs(y - lastScrollY.current)
      lastScrollY.current = y

      if (scrollAccumulator.current > 50) {
        setMinimized(true)
        scrollAccumulator.current = 0
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [visible, minimized, locked])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio || !audio.src) return
    if (audio.paused) {
      startLoading()
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }

  const skip = (s) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + s))
  }

  const cycleSpeed = () => {
    const next = (speedIndex + 1) % SPEEDS.length
    setSpeedIndex(next)
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next]
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return
    const nm = !audio.muted
    audio.muted = nm
    setMuted(nm)
  }

  const seekFromEvent = (e) => {
    const audio = audioRef.current
    const bar = progressRef.current
    if (!audio || !bar || !duration) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
  }

  const progress = duration ? (currentTime / duration) * 100 : 0
  const hasAudio = !!audioData?.src
  const shouldRender = visible && !minimized

  return (
    <div id='global-audio-player-root'>
      <audio ref={audioRef} preload='metadata' />

      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] sm:w-[90%] max-w-xl z-[9999] transition-all duration-500 ease-out transform ${
          shouldRender
            ? 'translate-y-0 opacity-100'
            : 'translate-y-full opacity-0 pointer-events-none'
        }`}>
        <div className='relative bg-white/50 dark:bg-gray-900/50 backdrop-blur-3xl border border-white/40 dark:border-gray-700/40 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] px-3 py-2.5 flex items-center gap-3'>

          <div className='relative flex-shrink-0 w-11 h-11 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-sm'>
            {coverSrc ? (
              <img src={coverSrc} alt='封面' className='w-full h-full object-cover' />
            ) : (
              <div className='w-full h-full bg-gradient-to-br from-[#5A6A9A] to-[#3A4A7A]' />
            )}
            {hasAudio && (
              <button
                onClick={togglePlay}
                className='absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors text-white'>
                {loading ? (
                  <LoadingIcon size={20} />
                ) : playing ? (
                  <PauseIcon size={20} />
                ) : (
                  <PlayIcon size={20} />
                )}
              </button>
            )}
          </div>

          <div className='flex-1 min-w-0 flex flex-col justify-center gap-1.5'>
            <div className='font-bold text-xs text-gray-800 dark:text-gray-100 w-full overflow-hidden'>
              {noAudioMessage ? (
                <span className='truncate block text-gray-500 dark:text-gray-400'>
                  {noAudioMessage}
                </span>
              ) : audioData?.href ? (
                <SmartLink
                  href={audioData.href}
                  className='hover:text-[#3A4A7A] transition-colors block w-full overflow-hidden'>
                  <span
                    ref={titleRef}
                    className={titleOverflow ? 'animate-marquee' : 'truncate block'}>
                    {audioData.title || '未知节目'}
                  </span>
                </SmartLink>
              ) : (
                <div className='w-full overflow-hidden'>
                  <span
                    ref={titleRef}
                    className={titleOverflow ? 'animate-marquee' : 'truncate block'}>
                    {audioData?.title || '未知节目'}
                  </span>
                </div>
              )}
            </div>

            {hasAudio && (
              <div className='flex items-center gap-1.5'>
                <span className='text-[10px] text-gray-500 tabular-nums text-left'>
                  {formatTime(currentTime)}
                </span>
                <div
                  ref={progressRef}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    seekFromEvent(e)
                  }}
                  className='flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer relative min-w-[60px]'>
                  <div
                    className='h-full rounded-full'
                    style={{
                      width: `${progress}%`,
                      background:
                        'linear-gradient(90deg, #8B9BD4 0%, #4A5A8A 50%, #3A4A7A 100%)'
                    }}
                  />
                </div>
                <span className='text-[10px] text-gray-500 tabular-nums'>
                  {formatTime(duration)}
                </span>

                <div className='hidden sm:flex items-center gap-1'>
                  <button
                    onClick={() => skip(-5)}
                    className='text-gray-500 hover:text-[#3A4A7A] transition-colors'
                    title='后退5秒'>
                    <i className='fa-solid fa-rotate-left text-xs' />
                  </button>
                  <button
                    onClick={() => skip(5)}
                    className='text-gray-500 hover:text-[#3A4A7A] transition-colors'
                    title='前进5秒'>
                    <i className='fa-solid fa-rotate-right text-xs' />
                  </button>
                  <button
                    onClick={cycleSpeed}
                    className='w-9 h-5 rounded text-[10px] font-bold text-gray-500 hover:text-[#3A4A7A] border border-gray-300 dark:border-gray-600 transition-colors flex items-center justify-center'
                    title='切换倍速'>
                    {SPEEDS[speedIndex]}x
                  </button>
                </div>

                <button
                  onClick={() => setShowMore((v) => !v)}
                  className='sm:hidden text-gray-500 hover:text-[#3A4A7A] transition-colors'
                  title='更多'>
                  <i className='fa-solid fa-ellipsis-vertical text-xs' />
                </button>
              </div>
            )}
          </div>

          <div className='flex items-center justify-end gap-1 flex-shrink-0'>
            {hasAudio && (
              <div
                className='relative hidden sm:flex items-center'
                onMouseEnter={() => setShowVolume(true)}
                onMouseLeave={() => setShowVolume(false)}>
                <button
                  onClick={toggleMute}
                  className='w-8 h-8 flex items-center justify-center text-gray-500 hover:text-[#3A4A7A] transition-colors'
                  title='音量'>
                  <i
                    className={`fa-solid ${
                      muted ? 'fa-volume-xmark' : 'fa-volume-high'
                    } text-sm`}
                  />
                </button>
                {showVolume && (
                  <div className='absolute bottom-full left-1/2 -translate-x-1/2 pb-2'>
                    <div
                      className='p-3 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-600 z-50 flex items-center justify-center'
                      style={{ width: '36px', height: '100px' }}>
                      <input
                        type='range'
                        min='0'
                        max='1'
                        step='0.05'
                        value={muted ? 0 : volume}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value)
                          setVolume(v)
                          setMuted(false)
                          if (audioRef.current) {
                            audioRef.current.volume = v
                            audioRef.current.muted = false
                          }
                        }}
                        className='w-20 h-1 cursor-pointer'
                        style={{
                          accentColor: '#3A4A7A',
                          transform: 'rotate(-90deg)',
                          transformOrigin: 'center'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setLocked((v) => !v)}
              className={`w-8 h-8 flex items-center justify-center transition-colors flex-shrink-0 ${
                locked ? 'text-[#3A4A7A]' : 'text-gray-400 hover:text-[#3A4A7A]'
              }`}
              title={locked ? '已固定，点击解锁' : '点击固定播放器，滑动页面不隐藏'}>
              <i className={`fa-solid ${locked ? 'fa-lock' : 'fa-lock-open'} text-xs`} />
            </button>

            {!locked && (
              <button
                onClick={() => setMinimized(true)}
                className='w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#3A4A7A] transition-colors flex-shrink-0'
                title='隐藏播放器'>
                <i className='fa-solid fa-chevron-down text-xs' />
              </button>
            )}
          </div>

          {showMore && hasAudio && (
            <div className='absolute bottom-full left-1/2 -translate-x-1/2 mb-2 sm:hidden'>
              <div className='bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-xl shadow-xl border border-white/40 dark:border-gray-700/40 px-4 py-2.5 flex items-center gap-4'>
                <button
                  onClick={() => skip(-5)}
                  className='flex flex-col items-center gap-0.5 text-gray-600 hover:text-[#3A4A7A] transition-colors'
                  title='后退5秒'>
                  <i className='fa-solid fa-rotate-left text-sm' />
                  <span className='text-[10px]'>退5s</span>
                </button>
                <button
                  onClick={() => skip(5)}
                  className='flex flex-col items-center gap-0.5 text-gray-600 hover:text-[#3A4A7A] transition-colors'
                  title='前进5秒'>
                  <i className='fa-solid fa-rotate-right text-sm' />
                  <span className='text-[10px]'>进5s</span>
                </button>
                <button
                  onClick={cycleSpeed}
                  className='flex flex-col items-center gap-0.5 text-gray-600 hover:text-[#3A4A7A] transition-colors'
                  title='切换倍速'>
                  <span className='text-xs font-bold'>{SPEEDS[speedIndex]}x</span>
                  <span className='text-[10px]'>倍速</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        .animate-marquee {
          display: inline-block;
          white-space: nowrap;
          animation: marquee 18s linear infinite;
        }
      `}</style>
    </div>
  )
}
