import LazyImage from '@/components/LazyImage'
import NotionIcon from '@/components/NotionIcon'
import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import { formatDateFmt } from '@/lib/utils/formatDate'
import SmartLink from '@/components/SmartLink'
import { getCategoryUrl } from '@/lib/utils/category' // ✨ 新增：引入首页用的同一个工具函数
import { useEffect, useRef, useState } from 'react'

const PlayIcon = ({ size = 12 }) => (
  <svg
    viewBox='0 0 24 24'
    width={size}
    height={size}
    fill='currentColor'
    style={{ marginLeft: '1px' }}>
    <path d='M8 5v14l11-7z' />
  </svg>
)

const PauseIcon = ({ size = 12 }) => (
  <svg
    viewBox='0 0 24 24'
    width={size}
    height={size}
    fill='currentColor'>
    <rect x='6' y='5' width='4' height='14' rx='1' />
    <rect x='14' y='5' width='4' height='14' rx='1' />
  </svg>
)

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

const formatRemaining = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '-0:00'

  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60

  if (h > 0) {
    return `-${h}:${m.toString().padStart(2, '0')}:${s
      .toString()
      .padStart(2, '0')}`
  }

  return `-${m}:${s.toString().padStart(2, '0')}`
}

const extractEpisodeNumber = (slug) => {
  if (!slug) return ''

  const match = String(slug).match(/(\d+)(?!.*\d)/)

  return match ? match[1] : ''
}

export default function PostHero({ post, siteInfo }) {
  // ✨ 从 useGlobal 中额外解构出 NOTION_CONFIG，这是 getCategoryUrl 需要的参数
  const { fullWidth, NOTION_CONFIG } = useGlobal()

  const [isPlaying, setIsPlaying] = useState(false)
  const [isCurrentSrc, setIsCurrentSrc] = useState(false)
  const [progress, setProgress] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [localDuration, setLocalDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const localAudioRef = useRef(null)

  const primaryColor =
    siteConfig('HEXO_COLOR_PRIMARY', '#3A4A7A') || '#3A4A7A'

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
          setProgress((currentTime / dur) * 100)
          setRemaining(Math.max(0, dur - currentTime))
        }
      } else {
        setIsCurrentSrc(false)
        setIsPlaying(false)
        setIsLoading(false)
      }
    }

    window.addEventListener('global-audio-state', onState)

    return () =>
      window.removeEventListener('global-audio-state', onState)
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

  const headerImage = post?.pageCover
    ? post.pageCover
    : siteInfo?.pageCover

  const episodeNumber = extractEpisodeNumber(post?.slug)

  const playedBarStyle = {
    width: `${progress}%`,
    background:
      progress > 0
        ? `linear-gradient(90deg, #8B9BD4 0%, #4A5A8A 50%, ${primaryColor} 100%)`
        : 'transparent'
  }

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

                <div className='flex flex-wrap items-center gap-x-3 gap-y-1 mb-6 text-sm font-light text-white/70'>
                  {episodeNumber && (
                    <>
                      <span className='whitespace-nowrap text-white/70'>
                        E{episodeNumber}
                      </span>

                      <span className='text-white/30'>·</span>
                    </>
                  )}

                  {post.category && (
                    <SmartLink
                      // ✨ 这里完美替换成了和首页相同的工具函数
                      href={getCategoryUrl(post.category, NOTION_CONFIG)}
                      passHref
                      legacyBehavior>
                      <span className='hero-meta-link font-bold'>
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
                            href={`/tag/${encodeURIComponent(
                              tag.name
                            )}`}
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

                    <div className='flex items-center gap-3 w-full'>
                      <button
                        onClick={handlePlayClick}
                        className='flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105 text-white'
                        style={{
                          background:
                            isCurrentSrc && isPlaying
                              ? `linear-gradient(135deg, #7B8BC4 0%, ${primaryColor} 100%)`
                              : 'rgba(255,255,255,0.15)',
                          backdropFilter: 'blur(10px)'
                        }}>
                        {isCurrentSrc && isLoading ? (
                          <LoadingIcon size={14} />
                        ) : isCurrentSrc && isPlaying ? (
                          <PauseIcon size={14} />
                        ) : (
                          <PlayIcon size={14} />
                        )}
                      </button>

                      <div
                        className='flex-1 h-1 rounded-full overflow-hidden relative bg-white/15'
                        style={{
                          backdropFilter: 'blur(10px)'
                        }}>
                        <div
                          className='h-full rounded-full transition-all duration-300'
                          style={playedBarStyle}
                        />
                      </div>

                      <span className='flex-shrink-0 text-xs text-white/70 tabular-nums whitespace-nowrap'>
                        {formatRemaining(remaining)}
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
