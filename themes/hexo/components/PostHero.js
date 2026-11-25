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
        const isActive = i < activeBars
        return (
          <div
            key={i}
            className={`w-[2px] sm:w-[2.5px] rounded-full transition-colors duration-300 ${
              isActive ? 'bg-white/95' : 'bg-white/30'
            }`}
            style={{
              height: baseHeights[i],
              animation: isPlaying && isActive ? 'wave 1.8s ease-in-out infinite alternate' : 'none',
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
    if (parsed && parsed.audio) return parsed.audio
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
  return match ? match.at(1) : ''
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
  const rawThemeColor = (post?.themeColor || post?.ThemeColor || '').trim()
  const parsedColors = rawThemeColor
    .split(',')
    .map(c => c.trim())
    .filter(c => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c))

  const color1 = parsedColors.at(0) || '#4A5D94'
  const color2 = parsedColors.at(1) || (parsedColors.at(0) ? '#2C364F' : '#2E3B63')
  const hasGradientTheme = true

  const isFilled = progress >= 100

  return (
    <div
      id='header'
      className={`w-full ${
        hasGradientTheme ? 'min-h-[460px] pt-24 pb-12 lg:py-0 lg:h-[78vh]' : 'h-96 md:h-[80vh]'
      } relative md:flex-shrink-0 z-10 mb-6 flex items-center`}
      style={{ '--theme-primary': primaryColor }}>
      
      {/* 背景层：向下延伸 176px 铺到正文卡片背后，渐隐曲线直接融进网页真实底色，彻底消除白线 */}
      {/* 使用内联 maskImage 保证 SSR 直出，杜绝 FOUC 闪白线 */}
      <div
        className='absolute inset-x-0 top-0 -bottom-44 pointer-events-none select-none overflow-hidden'
        style={{
          WebkitMaskImage:
            'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 48%, rgba(0,0,0,0.82) 64%, rgba(0,0,0,0.48) 78%, rgba(0,0,0,0.16) 90%, rgba(0,0,0,0) 100%)',
          maskImage:
            'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 48%, rgba(0,0,0,0.82) 64%, rgba(0,0,0,0.48) 78%, rgba(0,0,0,0.16) 90%, rgba(0,0,0,0) 100%)'
        }}>
        {/* 1. 极淡封面纹理 */}
        <LazyImage
          priority={true}
          src={headerImage}
          className='w-full h-full object-cover object-center absolute top-0 opacity-20 blur-3xl scale-125'
        />

        {/* 2. 主色调弥散光晕 + 斜向渐变 */}
        <div
          className='absolute inset-0 opacity-90 dark:opacity-95'
          style={{
            background: `radial-gradient(circle at 78% 30%, ${color1}dd 0%, transparent 58%), linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`
          }}
        />

        {/* 3. 轻柔压暗保护层，保证白天/夜间白字和播放器清晰 */}
        <div className='absolute inset-0 bg-black/15 dark:bg-black/30' />
      </div>

      <header
        id='article-header-cover'
        className='relative z-10 w-full flex items-center'>
        <div className='w-full px-4 md:px-8 lg:px-24'>
          <div className='w-full mx-auto lg:flex lg:space-x-4 lg:items-center justify-center'>
            {hasGradientTheme && headerImage && (
              <div className='flex lg:hidden justify-center mb-5'>
                <div className='podcast-cover-card relative w-[156px] h-[156px] rounded-[16px] overflow-hidden select-none'>
                  <LazyImage
                    priority={true}
                    src={headerImage}
                    alt={post.title}
                    className='w-full h-full object-cover object-center'
                  />
                </div>
              </div>
            )}

            <div className='w-full max-w-4xl md:pl-5'>
              <div
                className={`md:pl-5 ${
                  hasGradientTheme ? 'text-center lg:text-left' : ''
                }`}>
                <div className='leading-snug font-bold text-2xl sm:text-3xl lg:text-4xl md:leading-snug shadow-text-md text-white mb-3 lg:mb-4'>
                  {siteConfig('POST_TITLE_ICON') && (
                    <NotionIcon
                      icon={post.pageIcon}
                      className='text-2xl sm:text-3xl lg:text-4xl mr-1 inline-block'
                    />
                  )}
                  {post.title}
                </div>

                <div
                  className={`flex flex-wrap items-center ${
                    hasGradientTheme ? 'justify-center lg:justify-start' : ''
                  } gap-x-1.5 gap-y-1 mb-5 lg:mb-6 text-sm font-light text-white/70`}>
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
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        transform: 'translateZ(0)'
                      }}
                      onClick={handlePlayClick}
                    >
                      {progress > 0 && (
                        <div
                          className='absolute inset-0 pointer-events-none'
                          style={{
                            background: `linear-gradient(90deg, rgba(255, 255, 255, 0.6) 0%, ${primaryColor} 100%)`,
                            WebkitMaskImage: isFilled ? 'none' : `linear-gradient(to right, #000 calc(${progress}% - 24px), transparent ${progress}%)`,
                            maskImage: isFilled ? 'none' : `linear-gradient(to right, #000 calc(${progress}% - 24px), transparent ${progress}%)`,
                            opacity: isFilled ? 0.95 : (isPlaying ? 0.85 : 0.45),
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

            <div className='hidden lg:flex lg:w-80 flex-shrink-0 items-center justify-center'>
              {hasGradientTheme && headerImage && (
                <div className='podcast-cover-card relative w-[240px] h-[240px] rounded-[18px] overflow-hidden select-none'>
                  <LazyImage
                    priority={true}
                    src={headerImage}
                    alt={post.title}
                    className='w-full h-full object-cover object-center'
                  />
                </div>
              )}
            </div>
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
        .podcast-cover-card {
          box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.14);
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease;
        }
        .podcast-cover-card:hover {
          transform: translateY(-3px) scale(1.025);
          box-shadow: 0 26px 48px -12px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.24);
        }
      `}</style>
    </div>
  )
}
