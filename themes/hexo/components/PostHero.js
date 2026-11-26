import LazyImage from '@/components/LazyImage'
import NotionIcon from '@/components/NotionIcon'
import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import { getCategoryUrl } from '@/lib/utils/category'
import SmartLink from '@/components/SmartLink'
import { useEffect, useRef, useState } from 'react'

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

const getEpisodeNumber = (post) => {
  const slug = String(post?.slug || post?.href || '')
  const match = slug.match(/(\d+)(?!.*\d)/)
  return match ? match.at(1) : null
}

const PlayIcon = ({ size = 15 }) => (
  <svg viewBox='0 0 24 24' width={size} height={size} fill='currentColor' style={{ marginLeft: '2px' }}>
    <path d='M8 5v14l11-7z' />
  </svg>
)

const PauseIcon = ({ size = 15 }) => (
  <svg viewBox='0 0 24 24' width={size} height={size} fill='currentColor'>
    <rect x='6' y='5' width='4' height='14' rx='1' />
    <rect x='14' y='5' width='4' height='14' rx='1' />
  </svg>
)

const LoadingIcon = ({ size = 15 }) => {
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

// 恢复为最初精致短小的 24 根波形条，不再过长
const Waveform = ({ isPlaying, progress }) => {
  const bars = [35, 65, 45, 85, 55, 95, 40, 75, 60, 90, 50, 80, 45, 70, 95, 55, 80, 40, 65, 85, 50, 70, 45, 35]

  return (
    <div className='flex items-center gap-[2px] h-4 px-0.5'>
      {bars.map((height, i) => {
        const barPercent = ((i + 1) / bars.length) * 100
        const isPassed = progress >= barPercent
        return (
          <span
            key={i}
            className='w-[2px] rounded-full transition-colors duration-150'
            style={{
              height: `${height}%`,
              backgroundColor: isPassed ? '#ffffff' : 'rgba(255, 255, 255, 0.42)',
              transformOrigin: 'center',
              animation: isPlaying
                ? `wave-pulse ${0.5 + (i % 5) * 0.12}s ease-in-out infinite alternate`
                : 'none',
              animationDelay: `${(i % 7) * 0.08}s`
            }}
          />
        )
      })}
      <style jsx>{`
        @keyframes wave-pulse {
          0% { transform: scaleY(0.45); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}

export default function PostHero({ post, siteInfo }) {
  const { NOTION_CONFIG } = useGlobal()

  const audioUrl = post?.audio || parseExt(post?.ext)
  const episodeNumber = getEpisodeNumber(post)

  const localAudioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isCurrentSrc, setIsCurrentSrc] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [progress, setProgress] = useState(0)

  const primaryColor = siteConfig('HEXO_COLOR_PRIMARY', '#C87A38') || '#C87A38'

  useEffect(() => {
    const onState = (e) => {
      const { src, playing, currentTime, duration, loading } = e.detail
      if (src === audioUrl && audioUrl) {
        setIsCurrentSrc(true)
        setIsPlaying(playing)
        setIsLoading(!!loading)
        if (duration > 0) {
          setRemaining(Math.max(0, duration - currentTime))
          let p = (currentTime / duration) * 100
          if (duration - currentTime < 0.5) p = 100
          setProgress(p)
        }
      } else {
        setIsCurrentSrc(false)
        setIsPlaying(false)
        setIsLoading(false)
      }
    }
    window.addEventListener('global-audio-state', onState)
    return () => window.removeEventListener('global-audio-state', onState)
  }, [audioUrl])

  if (!post) {
    return null
  }

  const headerImage = post?.pageCoverThumbnail
    ? post.pageCoverThumbnail
    : siteInfo?.pageCover

  const rawThemeColor = (post?.themeColor || post?.ThemeColor || '').trim()
  const parsedColors = rawThemeColor
    .split(',')
    .map(c => c.trim())
    .filter(c => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c))
  const hasGradientTheme = post?.type === 'Post'
  const color1 = parsedColors.at(0) || primaryColor
  const color2 = parsedColors.at(1) || color1

  const handleMetadata = (e) => {
    if (!isCurrentSrc) {
      setRemaining(e.target.duration)
    }
  }

  const handlePlayClick = () => {
    window.dispatchEvent(
      new CustomEvent('toggle-global-audio', {
        detail: {
          src: audioUrl,
          cover: headerImage,
          title: post.title,
          href: post.href
        }
      })
    )
  }

  const handleMetaEnter = (e) => {
    e.currentTarget.style.color = 'var(--theme-color, #C87A38)'
    e.currentTarget.style.textShadow = '0 1px 10px rgba(0, 0, 0, 0.35)'
  }
  const handleMetaLeave = (e) => {
    e.currentTarget.style.color = ''
    e.currentTarget.style.textShadow = ''
  }

  const isFilled = progress >= 100

  return (
    <div
      id='header'
      className={`w-full ${
        hasGradientTheme
          ? 'min-h-[380px] pt-24 pb-8 lg:pt-14 lg:pb-0 lg:h-[54vh] lg:min-h-[420px]'
          : 'h-96 md:h-[80vh]'
      } relative md:flex-shrink-0 z-10 mb-4 flex items-center`}
      style={{ '--theme-primary': primaryColor }}>
      {hasGradientTheme ? (
        <div
          className='absolute inset-x-0 top-0 -bottom-56 pointer-events-none select-none overflow-hidden'
          style={{
            WebkitMaskImage:
              'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.92) 15%, rgba(0,0,0,0.74) 36%, rgba(0,0,0,0.5) 56%, rgba(0,0,0,0.26) 74%, rgba(0,0,0,0.08) 89%, rgba(0,0,0,0) 100%)',
            maskImage:
              'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.92) 15%, rgba(0,0,0,0.74) 36%, rgba(0,0,0,0.5) 56%, rgba(0,0,0,0.26) 74%, rgba(0,0,0,0.08) 89%, rgba(0,0,0,0) 100%)'
          }}>
          <div
            className='absolute inset-0 opacity-95 dark:opacity-100'
            style={{
              background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`
            }}
          />
          {headerImage && (
            <LazyImage
              priority={true}
              src={headerImage}
              alt={post.title}
              className='w-full h-full object-cover object-center absolute inset-0 opacity-20 dark:opacity-25 blur-3xl scale-125 mix-blend-soft-light'
            />
          )}
          <div className='absolute inset-0 bg-black/[0.04] dark:bg-black/30' />
        </div>
      ) : (
        <div className='absolute inset-0 pointer-events-none select-none overflow-hidden'>
          <LazyImage
            priority={true}
            src={headerImage}
            className='w-full h-full object-cover object-center absolute top-0'
          />
          <div className='bg-black bg-opacity-55 absolute inset-0' />
        </div>
      )}

      {audioUrl && (
        <audio
          ref={localAudioRef}
          src={audioUrl}
          preload='metadata'
          onLoadedMetadata={handleMetadata}
          style={{ display: 'none' }}
        />
      )}

      <header
        id='article-header-cover'
        className='relative z-10 w-full px-4 md:px-8 lg:px-24'>
        <div className='w-full mx-auto flex flex-col-reverse lg:flex-row lg:space-x-4 justify-center items-center gap-6 lg:gap-0'>
          
          {/* 左栏：手机端全部居中；电脑端严谨左对齐（lg:pl-12 lg:pr-6） */}
          <div className='w-full max-w-4xl'>
            <div className='w-full max-w-[92%] mx-auto md:max-w-none md:mx-0 lg:pl-12 lg:pr-6 text-center lg:text-left'>
              <div className='leading-snug font-bold text-2xl sm:text-3xl md:text-4xl md:leading-snug shadow-text-md text-white text-center lg:text-left'>
                {siteConfig('POST_TITLE_ICON') &&
                  post.pageIcon && (
                    <NotionIcon
                      icon={post.pageIcon}
                      className='text-3xl mr-1 inline-block'
                    />
                  )}
                {post.title}
              </div>

              {/* 元数据行：手机端居中，电脑端左对齐 */}
              <div className='mt-3 flex flex-wrap items-center justify-center lg:justify-start gap-x-2 gap-y-1 text-xs sm:text-sm text-white/85 font-light tracking-wide'>
                {episodeNumber && (
                  <>
                    <span className='font-medium text-white'>E{episodeNumber}</span>
                    <span className='opacity-40'>/</span>
                  </>
                )}
                {post?.category && (
                  <>
                    <SmartLink
                      href={getCategoryUrl(post.category, NOTION_CONFIG)}
                      passHref>
                      <span
                        onMouseEnter={handleMetaEnter}
                        onMouseLeave={handleMetaLeave}
                        className='cursor-pointer transition-colors duration-200'>
                        {post.category}
                      </span>
                    </SmartLink>
                    <span className='opacity-40'>/</span>
                  </>
                )}
                {post?.publishDay && (
                  <>
                    <span>{post.publishDay}</span>
                    {post?.tagItems?.length > 0 && <span className='opacity-40'>/</span>}
                  </>
                )}
                {post?.tagItems?.map(tag => (
                  <SmartLink
                    key={tag.name}
                    href={`/tag/${encodeURIComponent(tag.name)}`}
                    passHref>
                    <span
                      onMouseEnter={handleMetaEnter}
                      onMouseLeave={handleMetaLeave}
                      className='cursor-pointer transition-colors duration-200'>
                      {tag.name}
                    </span>
                  </SmartLink>
                ))}
              </div>

              {/* 播放器胶囊：恢复为最初的无外框纯净半透明白玻璃（与卡片右下角播控同款），手机端居中、电脑端左对齐 */}
              {audioUrl && (
                <div className='mt-6 flex justify-center lg:justify-start'>
                  <button
                    type='button'
                    onClick={handlePlayClick}
                    className='relative inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full text-white transition-all duration-300 shadow-md hover:bg-white/25 cursor-pointer overflow-hidden'
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.16)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      transform: 'translateZ(0)'
                    }}>
                    {progress > 0 && (
                      <div
                        className='absolute inset-0 pointer-events-none'
                        style={{
                          background: `linear-gradient(90deg, rgba(255, 255, 255, 0.32) 0%, var(--theme-color, #C87A38) 100%)`,
                          WebkitMaskImage: isFilled ? 'none' : `linear-gradient(to right, #000 calc(${progress}% - 24px), transparent ${progress}%)`,
                          maskImage: isFilled ? 'none' : `linear-gradient(to right, #000 calc(${progress}% - 24px), transparent ${progress}%)`,
                          opacity: isFilled ? 0.9 : isPlaying ? 0.85 : 0.5,
                          transition: 'opacity 0.3s ease'
                        }}
                      />
                    )}
                    <div className='relative z-10 flex-shrink-0 flex items-center justify-center w-5 h-5'>
                      {isLoading ? (
                        <LoadingIcon size={15} />
                      ) : isPlaying ? (
                        <PauseIcon size={15} />
                      ) : (
                        <PlayIcon size={15} />
                      )}
                    </div>
                    <div className='relative z-10'>
                      <Waveform isPlaying={isPlaying} progress={progress} />
                    </div>
                    <span className='relative z-10 text-xs font-medium tabular-nums pr-1 opacity-90'>
                      {formatDuration(remaining)}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 右栏：封面图 */}
          {hasGradientTheme && headerImage && (
            <div className='w-full lg:w-80 flex-shrink-0 flex justify-center'>
              <div className='w-44 h-44 sm:w-52 sm:h-52 lg:w-56 lg:h-56 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.45)] ring-1 ring-white/20 bg-white/5'>
                <LazyImage
                  priority={true}
                  src={headerImage}
                  alt={post.title}
                  className='w-full h-full object-cover object-center'
                />
              </div>
            </div>
          )}
          
        </div>
      </header>
    </div>
  )
}
