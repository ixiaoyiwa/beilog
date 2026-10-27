import LazyImage from '@/components/LazyImage'
import NotionIcon from '@/components/NotionIcon'
import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import SmartLink from '@/components/SmartLink'
import { getCategoryUrl } from '@/lib/utils/category'
import { useEffect, useRef, useState } from 'react'

const PlayIcon = ({ size = 16 }) => (
  <svg viewBox='0 0 24 24' width={size} height={size} fill='currentColor' style={{ marginLeft: '2px' }}>
    <path d='M8 5v14l11-7z' />
  </svg>
)

const PauseIcon = ({ size = 16 }) => (
  <svg viewBox='0 0 24 24' width={size} height={size} fill='currentColor'>
    <rect x='6' y='5' width='4' height='14' rx='1' />
    <rect x='14' y='5' width='4' height='14' rx='1' />
  </svg>
)

const LoadingIcon = ({ size = 16 }) => {
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

const Waveform = ({ isPlaying, progress }) => {
  const baseHeights = ['40%', '75%', '100%', '70%', '55%', '40%']
  const bars = baseHeights.length
  const activeBars = Math.ceil((progress / 100) * bars)

  return (
    <div className='flex items-center justify-center gap-[2px] sm:gap-[2.5px] h-[14px] sm:h-4 mx-0.5 sm:mx-1'>
      {Array.from({ length: bars }).map((_, i) => {
        const isActive = i < activeBars;
        return (
          <div
            key={i}
            className={`w-[2px] sm:w-[2.5px] rounded-full transition-colors duration-300 ${
              isActive ? 'bg-white/95' : 'bg-white/30'
            }`}
            style={{
              height: baseHeights[i],
              animation: isPlaying && isActive ? `wave 1.8s ease-in-out infinite alternate` : 'none',
              animationDelay: `${i * 0.15}s`,
              transformOrigin: 'center'
            }}
          />
        )
      })}
      <style jsx>{`
        @keyframes wave {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}

const parseExt = (ext) => {
  if (!ext) return null
  const raw = typeof ext === 'string' ? ext.trim() : ''
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (parsed?.audio) return parsed.audio
  } catch (e) {}

  if (raw.startsWith('http')) return raw

  return null
}

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

const extractEpisodeNumber = (slug) => {
  if (!slug) return ''
  const match = String(slug).match(/(\d+)(?!.*\d)/)
  return match ? match[1] : ''
}

export default function PostHero({ post, siteInfo }) {
  const { fullWidth, NOTION_CONFIG } = useGlobal()

  const [isPlaying, setIsPlaying] = useState(false)
  const [isCurrentSrc, setIsCurrentSrc] = useState(false)
  const [progress, setProgress] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [localDuration, setLocalDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const localAudioRef = useRef(null)

  const primaryColor = siteConfig('HEXO_COLOR_PRIMARY', '#3A4A7A') || '#3A4A7A'

  let audioUrl = post?.audio || null
  if (!audioUrl && post?.ext) {
    audioUrl = parseExt(post.ext)
  }

  const coverUrl = post?.pageCoverThumbnail || post?.pageCover

  useEffect(() => {
    const onState = (e) => {
      const { src, playing, currentTime, duration, loading } = e.detail
      if (audioUrl && src === audioUrl) {
        setIsCurrentSrc(true)
        setIsPlaying(playing)
        setIsLoading(!!loading)
        const dur = duration || localDuration
        
        if (dur > 0) {
          // 修复：防止播放完时停在 99.8% 没填满的问题
          let p = (currentTime / dur) * 100
          if (dur - currentTime < 0.5) p = 100
          
          setProgress(p)
          setRemaining(Math.max(0, dur - currentTime))
        }
      } else {
        setIsCurrentSrc(false)
        setIsPlaying(false)
        setIsLoading(false)
      }
    }
    window.addEventListener('global-audio-state', onState)
    return () => window.removeEventListener('global-audio-state', onState)
  }, [audioUrl, localDuration])

  const handleMetadata = (e) => {
    const dur = e.target.duration || 0
    setLocalDuration(dur)
    if (!isCurrentSrc) {
      setRemaining(dur)
    }
  }

  const handlePlayClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!audioUrl) return
    window.dispatchEvent(
      new CustomEvent('toggle-global-audio', {
        detail: {
          src: audioUrl,
          cover: coverUrl,
          title: post.title,
          href: post.href
        }
      })
    )
  }

  if (!post) {
    return <></>
  }

  if (fullWidth) {
    return <div className='my-8' />
  }

  const headerImage = post?.pageCover ? post.pageCover : siteInfo?.pageCover
  const episodeNumber = extractEpisodeNumber(post?.slug)

  const isFilled = progress >= 100

  return (
    <div
      id='header'
      className='w-full h-96 md:h-[80vh] relative md:flex-shrink-0 z-10 mb-8'
      style={{ '--theme-primary': primaryColor }}>
      <LazyImage
        priority={true}
        src={headerImage}
        className='w-full h-full object-cover object-center absolute top-0'
      />

      <header
        id='article-header-cover'
        className='bg-black bg-opacity-70 absolute top-0 w-full h-full flex items-center'>
        <div className='w-full px-4 md:px-8 lg:px-24'>
          <div className='w-full mx-auto lg:flex lg:space-x-4 justify-center'>
            <div className='w-full max-w-4xl md:pl-5'>
              <div className='md:pl-5'>
                <div className='leading-snug font-bold text-3xl sm:text-4xl md:leading-snug shadow-text-md text-white mb-4'>
                  {siteConfig('POST_TITLE_ICON') && (
                    <NotionIcon
                      icon={post.pageIcon}
                      className='text-3xl sm:text-4xl mr-1 inline-block'
                    />
                  )}
                  {post.title}
                </div>

                <div className='flex flex-wrap items-center gap-x-1.5 gap-y-1 mb-6 text-sm font-light text-white/70'>
                  {episodeNumber && (
                    <span className='whitespace-nowrap text-white/70'>
                      E{episodeNumber}
                    </span>
                  )}
                  {post.category && (
                    <SmartLink
                      href={getCategoryUrl(post.category, NOTION_CONFIG)}
                      passHref
                      legacyBehavior>
                      <span className='hero-meta-link'>
                        {post.category}
                      </span>
                    </SmartLink>
                  )}
                  {post?.type !== 'Page' && (
                    <>
                      <span className='text-white/30'>/</span>
                      <span className='text-white/70'>
                        {post?.publishDay || post.date}
                      </span>
                    </>
                  )}
                  {post.tagItems && post.tagItems.length > 0 && (
                    <>
                      <span className='text-white/30'>/</span>
                      <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
                        {post.tagItems.map(tag => (
                          <SmartLink
                            key={tag.name}
                            href={`/tag/${encodeURIComponent(tag.name)}`}
                            passHref
                            legacyBehavior>
                            <span className='hero-meta-link whitespace-nowrap'>
                              {tag.name}
                            </span>
                          </SmartLink>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {audioUrl && (
                  <div className='w-full'>
                    <audio
                      ref={localAudioRef}
                      src={audioUrl}
                      preload='metadata'
                      onLoadedMetadata={handleMetadata}
                      style={{ display: 'none' }}
                    />

                    <div
                      className='relative inline-flex items-center gap-1.5 sm:gap-2 px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-full transition-all duration-300 cursor-pointer select-none text-white overflow-hidden'
                      style={{
                        // 修复：未播放时恢复毛玻璃背景底色
                        backgroundColor: (isPlaying || progress > 0) ? 'transparent' : 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
                        transform: 'translateZ(0)'
                      }}
                      onClick={handlePlayClick}
                    >
                      {/* 动态渐变填充层 */}
                      {progress > 0 && (
                        <div
                          className='absolute top-0 bottom-0 left-0 pointer-events-none'
                          style={{
                            width: `${progress}%`,
                            // 增强渐变对比度：深主题色 -> 浅紫蓝色
                            background: `linear-gradient(90deg, ${primaryColor} 0%, #A1B1E0 100%)`,
                            // 修复：如果是 100% 填满，就不做遮罩；没满时做右侧 24px 的柔和发散
                            WebkitMaskImage: isFilled ? 'none' : `linear-gradient(to right, #000 calc(100% - 24px), transparent 100%)`,
                            maskImage: isFilled ? 'none' : `linear-gradient(to right, #000 calc(100% - 24px), transparent 100%)`,
                            // 暂停时半透明，播放或填满时全亮
                            opacity: (isPlaying || isFilled) ? 1 : 0.6,
                            transition: 'opacity 0.3s ease'
                          }}
                        />
                      )}

                      <div className='relative z-10 flex-shrink-0 flex items-center justify-center w-5 h-5 sm:w-[22px] sm:h-[22px]'>
                        {isCurrentSrc && isLoading ? (
                          <LoadingIcon size={16} />
                        ) : isCurrentSrc && isPlaying ? (
                          <PauseIcon size={16} />
                        ) : (
                          <PlayIcon size={16} />
                        )}
                      </div>

                      <div className='relative z-10 flex items-center'>
                        <Waveform isPlaying={isCurrentSrc && isPlaying} progress={progress} />
                      </div>

                      <span className='relative z-10 text-xs text-white/90 font-medium tabular-nums whitespace-nowrap'>
                        {formatDuration(remaining)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className='hidden lg:block lg:w-80 flex-shrink-0'></div>
          </div>
        </div>
      </header>

      <style jsx>{`
        .hero-meta-link {
          color: rgba(255, 255, 255, 0.7);
          transition: color 0.2s;
          cursor: pointer;
        }
        .hero-meta-link:hover {
          color: var(--theme-primary);
        }
      `}</style>
    </div>
  )
}
